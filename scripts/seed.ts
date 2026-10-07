/**
 * Layers known, idempotent test data onto a running ReCodEx instance via the
 * public API only (never SQL) -- see docs/DECISIONS.md and nextjs-frontend-agent-brief.md
 * "Build scripts/seed.ts in the first session, before any UI work" for the full spec this
 * implements. Run with `pnpm seed`.
 *
 * Every entity this script creates is named/tagged with SEED_PREFIX and looked up before
 * creating, so re-running it against its own previous output does not duplicate anything.
 * Wiping the database is an operator-level `docker compose down -v && up -d` action, not
 * something this script does or assumes -- see docs/SEED_ACCOUNTS.md for how to reset.
 */

import {
  API_BASE,
  SEED_PREFIX,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  FILLER_COUNT,
  api,
  log,
  login,
  getOrCreateUser,
  ensureGlobalRole,
  type GroupRecord,
  findGroupByName,
  getOrCreateGroup,
  ensureOrganizational,
  ensureArchived,
  ensurePublic,
  ensureStudentMember,
  ensureGroupMember,
  EXPECTED_OUTPUT,
  ensureAuthoredExercises,
  ensureCatalogExercises,
  getOrCreateBaseExercise,
  G1_HINTS,
  pickByHint,
  createAssignment,
  ensureAssignmentSynced,
  findAssignmentsForExercise,
  submitSolution,
  sweepUnintendedSeedSolutions,
  findSolutionByNote,
  ensureReviewRequested,
  ensureReviewOpened,
} from "./seed-lib";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * A finished exam with one lock record (S-008).
 *
 * The only unreachable state on the exams tab, and the only one with a recipe: core-api creates a
 * `GroupExam` **when a student first locks in**, never when the period is merely set, so a
 * previous exam -- and any lock record to show under it -- exists only if someone actually sat one.
 * The recipe is therefore the real sequence, compressed: set a period beginning now, let the
 * student lock themselves in, then end it by moving the end to now.
 *
 * Idempotent on the group already having a recorded exam, so a re-run neither piles up terms nor
 * locks anyone a second time. The period it opens is a minute wide even though it is ended within
 * a second of that: if this script dies in the middle, the group unsecures itself shortly after
 * rather than staying in exam mode until someone notices.
 */
async function ensureFinishedExam(
  adminToken: string,
  group: GroupRecord,
  student: { userId: string; token: string },
): Promise<boolean> {
  const before = await api<{ privateData?: { exams?: unknown[] } }>("GET", `/groups/${group.id}`, {
    token: adminToken,
  });
  if ((before.privateData?.exams ?? []).length > 0) return false;

  const begin = Math.floor(Date.now() / 1000);
  await api("POST", `/groups/${group.id}/examPeriod`, {
    token: adminToken,
    body: { begin, end: begin + 60, type: "visible" },
  });
  try {
    await api("POST", `/groups/${group.id}/lock/${student.userId}`, { token: student.token });
  } finally {
    // Ends the exam whatever happened to the lock -- a group left in secured mode would stop
    // every other seeded student from submitting anywhere in it. Never *at* the beginning: core-api
    // rejects a zero-wide interval, and the whole sequence here takes well under a second.
    await api("POST", `/groups/${group.id}/examPeriod`, {
      token: adminToken,
      body: { end: Math.max(begin + 2, Math.floor(Date.now() / 1000)) },
    });
  }
  return true;
}

/**
 * A reported similarity between two students' solutions (S-019).
 *
 * ReCodEx detects nothing itself: an external tool uploads what it found, so this fixture *is* the
 * upload -- create a batch, append one similarity, mark the batch complete. There is no other way
 * to reach the screen, and no endpoint to delete any of it afterwards, which is why this is
 * idempotent on the batch already existing for the tested solution.
 *
 * The fragment offsets are computed from the two sources rather than written down, so the marked
 * passages stay correct if either seeded solution is ever edited.
 */
const PLAGIARISM_TOOL = "seed-fixture";

async function firstSolutionFileId(token: string, solutionId: string): Promise<string> {
  const files = await api<{ id: string }[]>("GET", `/assignment-solutions/${solutionId}/files`, {
    token,
  });
  const file = files[0];
  if (!file) throw new Error(`solution ${solutionId} has no files to point a similarity at`);
  return file.id;
}

async function ensureDetectedSimilarity(
  adminToken: string,
  assignmentId: string,
  tested: { solutionId: string; source: string },
  other: { solutionId: string; authorId: string; source: string },
  sharedText: string,
): Promise<boolean> {
  const batches = await api<{ id: string }[]>(
    "GET",
    `/plagiarism?detectionTool=${encodeURIComponent(PLAGIARISM_TOOL)}&solutionId=${tested.solutionId}`,
    { token: adminToken },
  );
  // **A batch that exists is not a fixture that works.** An earlier run recorded this similarity
  // against a solution that has since been deleted, and "a batch exists, skip" kept that record
  // in place for every run after: the report screen had a match whose author was gone and
  // rendered nothing. Nothing can repair it either -- core-api publishes no way to remove a
  // detection record (**Q-029**) -- so a stale one is answered with a *new* batch, which is what
  // the solution's own `plagiarism` pointer then names. The unreachable rows stay in the database.
  const pointsAtIntended = await Promise.all(
    batches.map(async (batch) => {
      const similarities = await api<{ files?: { solution?: { id?: string } }[] }[]>(
        "GET",
        `/plagiarism/${batch.id}/${tested.solutionId}`,
        { token: adminToken },
      );
      // The matched solution is nested (`files[].solution.id`), not a flat id -- reading it as
      // one made every run think the fixture was stale and add another batch.
      return similarities.some((one) =>
        (one.files ?? []).some((file) => file.solution?.id === other.solutionId),
      );
    }),
  );
  if (pointsAtIntended.some(Boolean)) return false;
  if (batches.length > 0) {
    log(`the recorded similarity no longer matches the intended solution, recording a new one`);
  }

  const [testedFileId, otherFileId] = await Promise.all([
    firstSolutionFileId(adminToken, tested.solutionId),
    firstSolutionFileId(adminToken, other.solutionId),
  ]);

  const batch = await api<{ id: string }>("POST", "/plagiarism", {
    token: adminToken,
    body: { detectionTool: PLAGIARISM_TOOL, detectionToolParams: "--seeded" },
  });

  await api("POST", `/plagiarism/${batch.id}/${tested.solutionId}`, {
    token: adminToken,
    body: {
      solutionFileId: testedFileId,
      authorId: other.authorId,
      similarity: 0.87,
      files: [
        {
          solutionId: other.solutionId,
          solutionFileId: otherFileId,
          fileEntry: "",
          fragments: [
            [
              { offset: tested.source.indexOf(sharedText), length: sharedText.length },
              { offset: other.source.indexOf(sharedText), length: sharedText.length },
            ],
          ],
        },
      ],
    },
  });

  await api("POST", `/plagiarism/${batch.id}`, {
    token: adminToken,
    body: { uploadCompleted: true, assignments: [assignmentId] },
  });
  return true;
}

/**
 * A shadow assignment with points awarded to one student (S-020).
 *
 * The only kind of assignment in ReCodEx with nothing to submit: the teacher types the points in.
 * Creating one takes two calls -- `POST /shadow-assignments` makes an empty, non-public record,
 * and `update-detail` is what gives it a name, a text, a points limit and visibility (its `version`
 * has to match, which is core-api's optimistic-locking check).
 *
 * Idempotent on the group already having a shadow assignment, and on the student already having
 * points in it.
 */
/**
 * A shadow assignment, matched by its own name so a second one can exist beside the first --
 * S-025's dashboard section has an "awarded" row and a "nothing yet" row, and only one of those
 * was reachable while the seed produced a single, always-awarded assignment.
 *
 * `awardee` omitted means exactly that: create it and award nobody.
 */
async function ensureShadowAssignment(
  adminToken: string,
  group: GroupRecord,
  spec: { name: string; text: string; maxPoints: number; note?: string },
  awardee?: { userId: string },
): Promise<boolean> {
  const existing = await api<
    { id: string; localizedTexts: { name: string }[]; points?: { awardeeId: string }[] }[]
  >("GET", `/groups/${group.id}/shadow-assignments`, { token: adminToken });
  const match = existing.find((assignment) =>
    assignment.localizedTexts.some((text) => text.name === spec.name),
  );

  if (match) {
    if (!awardee) return false;
    if (match.points?.some((record) => record.awardeeId === awardee.userId)) return false;
    await api("POST", `/shadow-assignments/${match.id}/create-points`, {
      token: adminToken,
      body: { userId: awardee.userId, points: 8, note: spec.note ?? "" },
    });
    return true;
  }

  const created = await api<{ id: string; version: number }>("POST", "/shadow-assignments", {
    token: adminToken,
    body: { groupId: group.id },
  });
  await api("POST", `/shadow-assignments/${created.id}`, {
    token: adminToken,
    body: {
      version: created.version,
      isPublic: true,
      isBonus: false,
      maxPoints: spec.maxPoints,
      sendNotification: false,
      deadline: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
      localizedTexts: [{ locale: "en", name: spec.name, text: spec.text }],
    },
  });
  if (awardee) {
    await api("POST", `/shadow-assignments/${created.id}/create-points`, {
      token: adminToken,
      body: { userId: awardee.userId, points: 8, note: spec.note ?? "" },
    });
  }
  return true;
}

/**
 * The four invitation links S-023's page can be reached by, one per state it renders. No group had
 * any, so every branch of that screen was unreachable.
 *
 * Matched by their note rather than by id, the same way `findSolutionByNote` does it: core-api
 * gives an invitation no name, and re-running the seed must not mint a fifth link every time.
 * `expireAt` in the past is a legitimate value core-api accepts on create -- it validates the
 * timestamp, not its direction -- which is the only way to seed an expired link without waiting.
 */
async function ensureGroupInvitation(
  adminToken: string,
  group: GroupRecord,
  note: string,
  expireAtSeconds: number | null,
): Promise<boolean> {
  const existing = await api<{ id: string; note: string | null }[]>(
    "GET",
    `/groups/${group.id}/invitations`,
    { token: adminToken },
  );
  if (existing.some((invitation) => invitation.note === note)) return false;

  await api("POST", `/groups/${group.id}/invitations`, {
    token: adminToken,
    body: { expireAt: expireAtSeconds, note },
  });
  return true;
}

/**
 * Which instance to seed into.
 *
 * **This used to be `instances[0]`, and that was a real bug rather than a shortcut.** This
 * deployment has two instances, `GET /instances` guarantees no ordering, and the order it returns
 * evidently changed between runs: an earlier run seeded one instance and a later one seeded the
 * *other*, leaving two half-sets of identically-named groups across two roots. Every spec that
 * navigates by group name then matched two links, or none, depending on which half it found -- and
 * three sessions in a row diagnosed that as "the group is missing" because nothing said which
 * instance anybody was looking at.
 *
 * So the instance is chosen by **where this script's own groups already are**, which makes a
 * re-run land where the last run landed however `/instances` is ordered -- the property this
 * script's own docblock claims ("safe to run again on top of its own previous output"). Only when
 * no seeded group exists anywhere does it fall back to the first instance, and it says so.
 *
 * `SEED_INSTANCE_ID` overrides both, for an operator who wants a specific one.
 */
async function chooseInstance(adminToken: string): Promise<string> {
  const instances = await api<{ id: string }[]>("GET", "/instances", { token: adminToken });
  if (instances.length === 0) throw new Error("GET /instances returned no instances.");

  const override = process.env.SEED_INSTANCE_ID;
  if (override) {
    if (!instances.some((i) => i.id === override)) {
      throw new Error(`SEED_INSTANCE_ID=${override} is not one of this deployment's instances.`);
    }
    log(`instance ${override} (from SEED_INSTANCE_ID)`);
    return override;
  }

  // Any of this script's own top-level groups anchors the choice, not one particular name: a run
  // that died part-way may have created only some of them, which is exactly the state this
  // function exists to recover from.
  const anchors = [
    `${SEED_PREFIX} Intro to Programming`,
    `${SEED_PREFIX} Large Lecture`,
    `${SEED_PREFIX} Faculty of Seeded Studies`,
  ];
  for (const instance of instances) {
    for (const anchor of anchors) {
      if (await findGroupByName(adminToken, instance.id, anchor)) {
        log(`instance ${instance.id} (already holds ${anchor}, reusing it)`);
        return instance.id;
      }
    }
  }

  const first = instances[0]!;
  log(
    `instance ${first.id} (nothing seeded anywhere yet; ${instances.length} instance(s) exist, ` +
      `set SEED_INSTANCE_ID to choose)`,
  );
  return first.id;
}

async function main() {
  log(`seeding against ${API_BASE}`);
  const nowSeconds = Math.floor(Date.now() / 1000);

  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const instanceId = await chooseInstance(admin.token);

  // Groups -- G1 has a subgroup, G2 is archived, G3 exists purely to exercise pagination.
  const g1 = await getOrCreateGroup(admin.token, instanceId, {
    name: `${SEED_PREFIX} Intro to Programming`,
  });
  const g1a = await getOrCreateGroup(admin.token, instanceId, {
    name: `${SEED_PREFIX} Intro to Programming / Lab A`,
    parentGroupId: g1.id,
  });
  const g2 = await getOrCreateGroup(admin.token, instanceId, {
    name: `${SEED_PREFIX} Retired Course`,
  });
  const g3 = await getOrCreateGroup(admin.token, instanceId, {
    name: `${SEED_PREFIX} Large Lecture`,
  });

  // Users -- one per role combination called for in the brief; admin@admin.com (superadmin)
  // is reused as-is, never duplicated.
  const student1 = await getOrCreateUser(admin.token, instanceId, {
    email: "alice.student@seed.recodex.local",
    firstName: "Alice",
    lastName: "Student",
  });
  await ensureStudentMember(admin.token, g1, student1.userId);

  // A second student in G1, so there is somebody for a detected similarity to be *with* (S-019):
  // a plagiarism record needs two authors, and Alice was the only student in the group.
  const student2 = await getOrCreateUser(admin.token, instanceId, {
    email: "bob.classmate@seed.recodex.local",
    firstName: "Bob",
    lastName: "Classmate",
  });
  await ensureStudentMember(admin.token, g1, student2.userId);

  const supervisor1 = await getOrCreateUser(admin.token, instanceId, {
    email: "sam.supervisor@seed.recodex.local",
    firstName: "Sam",
    lastName: "Supervisor",
    role: "supervisor",
  });
  await ensureGlobalRole(admin.token, supervisor1.userId, "supervisor");
  await ensureGroupMember(admin.token, g1, supervisor1.userId, "admin");
  await ensureGroupMember(admin.token, g2, supervisor1.userId, "supervisor");
  await ensureArchived(admin.token, g2); // after membership -- see ensureArchived's comment

  const supervisorStudent1 = await getOrCreateUser(admin.token, instanceId, {
    email: "sasha.mentor@seed.recodex.local",
    firstName: "Sasha",
    lastName: "Mentor",
    role: "supervisor-student",
  });
  await ensureGlobalRole(admin.token, supervisorStudent1.userId, "supervisor-student");
  await ensureGroupMember(admin.token, g3, supervisorStudent1.userId, "admin");
  await ensureStudentMember(admin.token, g1a, supervisorStudent1.userId);

  // A user who belongs to nowhere (F-029): the state every genuinely new account starts in, and
  // the only way to reach the dashboard's "no group memberships" empty state.
  const newcomer = await getOrCreateUser(admin.token, instanceId, {
    email: "seed.newcomer@seed.recodex.local",
    firstName: "Nora",
    lastName: "Newcomer",
  });
  log(`newcomer (no memberships): ${newcomer.userId}`);

  // An organizational group (F-029): holds other groups, carries no assignments of its own.
  const g4 = await getOrCreateGroup(admin.token, instanceId, {
    name: `${SEED_PREFIX} Faculty of Seeded Studies`,
  });
  await ensureOrganizational(admin.token, g4);

  // The one exercise every assignment below reuses -- built and verified once; see
  // docs/DECISIONS.md for the full API recipe this encodes and why it's a single exercise
  // rather than one per assignment.
  const exercise = await getOrCreateBaseExercise(admin.token, g1.id);

  // G1: a "real" assignment with mixed submission states, plus a second assignment with
  // nothing submitted -- both required states per the brief. Each is found by its own student
  // hint if this group already has assignments for this exercise (`pickByHint`).
  const existingG1Assignments = await findAssignmentsForExercise(admin.token, g1, exercise.id);
  const primaryAssignment =
    pickByHint(existingG1Assignments, G1_HINTS.primary) ??
    (await createAssignment(admin.token, exercise.id, g1.id, {
      firstDeadlineDays: 14,
      maxPoints: 10,
      hint: G1_HINTS.primary,
    }));
  await submitSolution(
    student1.token,
    student1.userId,
    primaryAssignment.id,
    `${SEED_PREFIX} correct`,
    [{ name: "solution.py", content: `print("${EXPECTED_OUTPUT.trim()}")\n` }],
  );
  await submitSolution(
    student1.token,
    student1.userId,
    primaryAssignment.id,
    `${SEED_PREFIX} wrong`,
    [{ name: "solution.py", content: `print("Nope")\n` }],
  );

  // A solution made of **more than one file**, which is the fixture G-005's diff viewer and
  // G-030's hand-pairing exist for: it shares no filename with any other attempt, so the pairing
  // by name leaves something unpaired. It is also the only seeded submission that reaches S-014's
  // entry-point picker, which appears exactly when a solution has several files.
  //
  // **This used to be a single ZIP archive and can no longer be one.** `Solution::getFileNames()`
  // reports the uploaded name (`solution.zip`), not the entries inside it, so the exercise's
  // `source-files` wildcard `*.py` matches nothing and core-api refuses the submission outright.
  // That refusal is upstream behaviour rather than a limitation of this seed -- it was simply
  // invisible while the broken configuration skipped wildcard matching altogether. A real
  // multi-file solution keeps every property this fixture is used for, and grades.
  await submitSolution(
    student1.token,
    student1.userId,
    primaryAssignment.id,
    `${SEED_PREFIX} multi-file`,
    // `main.py` first because that is the one that is started -- see `entryPointParams`.
    [
      { name: "main.py", content: "from greeting import GREETING\n\nprint(GREETING)\n" },
      { name: "greeting.py", content: `GREETING = "${EXPECTED_OUTPUT.trim()}"\n` },
    ],
  );

  // Teacher-facing fixtures (S-002): one solution whose author has asked for a review, and one
  // whose review a teacher has opened and not finished. Neither state can be produced by
  // submitting alone, and without them the teacher dashboard has nothing to render.
  await ensureReviewRequested(
    student1.token,
    student1.userId,
    primaryAssignment.id,
    `${SEED_PREFIX} correct`,
  );
  // **Opened by the course's own supervisor, not by the site admin.** "Reviews you have open" is
  // the reviews *this reader* started, and "Reviews students have asked for" is the requests in
  // groups *this reader* supervises -- so opening it as the admin, who supervises nothing, left no
  // single account with both, and the teacher dashboard's two queues could not be read together.
  // Sam administers this group, which is also who would really be reading them.
  await ensureReviewOpened(
    supervisor1.token,
    student1.userId,
    primaryAssignment.id,
    `${SEED_PREFIX} wrong`,
  );

  const unsubmittedAssignment =
    pickByHint(existingG1Assignments, G1_HINTS.unsubmitted) ??
    (await createAssignment(admin.token, exercise.id, g1.id, {
      firstDeadlineDays: 21,
      maxPoints: 10,
      hint: G1_HINTS.unsubmitted,
    }));

  // The only assignment anywhere with a second deadline (F-029).
  const secondDeadlineAssignment =
    pickByHint(existingG1Assignments, G1_HINTS.secondDeadline) ??
    (await createAssignment(admin.token, exercise.id, g1.id, {
      firstDeadlineDays: 3,
      maxPoints: 10,
      secondDeadlineDays: 14,
      secondDeadlineMaxPoints: 5,
      hint: G1_HINTS.secondDeadline,
    }));

  // G3: enough students and assignments to force pagination in any list/table view.
  const fillerStudentIds: string[] = [];
  for (let i = 1; i <= FILLER_COUNT; i++) {
    const n = String(i).padStart(2, "0");
    const filler = await getOrCreateUser(admin.token, instanceId, {
      email: `seed.filler.${n}@seed.recodex.local`,
      firstName: `${SEED_PREFIX} Filler`,
      lastName: `Student ${n}`,
    });
    await ensureStudentMember(admin.token, g3, filler.userId);
    fillerStudentIds.push(filler.userId);
  }

  const existingFillerAssignments = (await findAssignmentsForExercise(admin.token, g3, exercise.id))
    .length;
  for (let i = existingFillerAssignments; i < FILLER_COUNT; i++) {
    await createAssignment(admin.token, exercise.id, g3.id, {
      firstDeadlineDays: 7 + i,
      maxPoints: 10,
      hint: `${SEED_PREFIX} filler assignment #${i + 1}`,
    });
  }
  if (existingFillerAssignments > 0) {
    log(
      `${existingFillerAssignments}/${FILLER_COUNT} filler assignments already existed, topped up the rest`,
    );
  }

  // A reported similarity between two students (S-019). Bob's solution shares one line with
  // Alice's, which is the passage the fixture marks on both sides.
  const SHARED_LINE = `print("${EXPECTED_OUTPUT.trim()}")`;
  const aliceSource = `${SHARED_LINE}\n`;
  const bobSource = `# my own work, obviously\n${SHARED_LINE}\n`;
  await submitSolution(
    student2.token,
    student2.userId,
    primaryAssignment.id,
    `${SEED_PREFIX} borrowed`,
    [{ name: "solution.py", content: bobSource }],
  );

  const aliceSolution = await findSolutionByNote(
    admin.token,
    primaryAssignment.id,
    student1.userId,
    `${SEED_PREFIX} correct`,
  );
  const bobSolution = await findSolutionByNote(
    admin.token,
    primaryAssignment.id,
    student2.userId,
    `${SEED_PREFIX} borrowed`,
  );
  if (aliceSolution && bobSolution) {
    log(
      (await ensureDetectedSimilarity(
        admin.token,
        primaryAssignment.id,
        { solutionId: aliceSolution.id, source: aliceSource },
        { solutionId: bobSolution.id, authorId: student2.userId, source: bobSource },
        SHARED_LINE,
      ))
        ? "uploaded one detected similarity between two students"
        : "a detected similarity was already recorded",
    );
  }

  // Bob submits to a **second** assignment (T-005). The group-wide drill-down counts "N
  // submissions across M assignments", and with every seeded submission on one assignment M was
  // always 1 -- the aggregation the screen exists for had no data, and the spec that asserts two
  // across two was passing on residue left by earlier suite runs rather than on anything the seed
  // made. On the second-deadline assignment because that one is identified by its deadline rather
  // than by counting solutions, so adding one cannot confuse anything that looks for it.
  await submitSolution(
    student2.token,
    student2.userId,
    secondDeadlineAssignment.id,
    `${SEED_PREFIX} second try`,
    [{ name: "solution.py", content: `print("${EXPECTED_OUTPUT.trim()}")\n` }],
  );

  await sweepUnintendedSeedSolutions(
    admin.token,
    [primaryAssignment.id, secondDeadlineAssignment.id, unsubmittedAssignment.id],
    [
      { assignmentId: primaryAssignment.id, authorId: student1.userId, note: "correct" },
      { assignmentId: primaryAssignment.id, authorId: student1.userId, note: "wrong" },
      { assignmentId: primaryAssignment.id, authorId: student1.userId, note: "multi-file" },
      { assignmentId: primaryAssignment.id, authorId: student2.userId, note: "borrowed" },
      { assignmentId: secondDeadlineAssignment.id, authorId: student2.userId, note: "second try" },
    ],
  );

  // Two shadow assignments (S-020, S-025): one with points awarded to Alice, one with none, so the
  // dashboard's "awarded" and "nothing yet" rows are both reachable.
  const shadowSeeded = [
    await ensureShadowAssignment(
      admin.token,
      g1,
      {
        name: `${SEED_PREFIX} Oral Exam`,
        text: "Points for the oral exam. Nothing is submitted here — the examiner awards the points.",
        maxPoints: 10,
        note: `${SEED_PREFIX} oral exam`,
      },
      student1,
    ),
    await ensureShadowAssignment(admin.token, g1, {
      name: `${SEED_PREFIX} Term Presentation`,
      text: "Points for the end-of-term presentation. Nothing has been awarded yet.",
      maxPoints: 20,
    }),
  ].filter(Boolean).length;
  log(
    shadowSeeded > 0
      ? `created or awarded ${shadowSeeded} shadow assignments`
      : "both shadow assignments already existed",
  );

  // A public group nobody is enrolled in (S-026): the one shape of group a student can join on
  // their own, and the only way the Join control is reachable at all.
  const g5 = await getOrCreateGroup(admin.token, instanceId, {
    name: `${SEED_PREFIX} Open Enrolment`,
  });
  log(
    (await ensurePublic(admin.token, g5))
      ? "made a public group anyone may join"
      : "the public group already existed",
  );

  // One invitation link per state S-023's page renders (S-023). G3 is the group Alice can still
  // join; G1 is one she already studies in; G4 is organizational and G2 archived, neither of which
  // core-api will enrol anyone into. An archived group still accepts new *invitations* -- only
  // accepting them is refused -- which is what makes that last fixture possible at all.
  const invitations: [GroupRecord, string, number | null][] = [
    [g3, `${SEED_PREFIX} open invitation`, nowSeconds + 30 * 24 * 3600],
    [g3, `${SEED_PREFIX} expired invitation`, nowSeconds - 24 * 3600],
    [g1, `${SEED_PREFIX} invitation to a group already joined`, null],
    [g4, `${SEED_PREFIX} invitation to an organizational group`, nowSeconds + 30 * 24 * 3600],
    [g2, `${SEED_PREFIX} invitation to an archived group`, nowSeconds + 30 * 24 * 3600],
  ];
  let mintedInvitations = 0;
  for (const [group, note, expireAt] of invitations) {
    if (await ensureGroupInvitation(admin.token, group, note, expireAt)) mintedInvitations++;
  }
  log(
    mintedInvitations > 0
      ? `created ${mintedInvitations} group invitation links`
      : "the group invitation links already existed",
  );

  // A held exam, with the one lock record that makes it exist at all (S-008).
  log(
    (await ensureFinishedExam(admin.token, g1, student1))
      ? "recorded one finished exam, with a student lock"
      : "a finished exam was already recorded",
  );

  // Assignments are snapshots of the exercise, so any exercise fix above has to be pushed into the
  // ones already made from it -- see ensureAssignmentSynced. This runs on *every* seed, not only
  // the first: `getOrCreateBaseExercise` deliberately rewrites the exercise's configuration each
  // time (F-025's own reasoning), which by definition leaves every assignment one version behind.
  let synced = 0;
  for (const group of [g1, g3]) {
    for (const assignment of await findAssignmentsForExercise(admin.token, group, exercise.id)) {
      if (await ensureAssignmentSynced(admin.token, assignment.id)) synced++;
    }
  }
  log(
    synced > 0 ? `${synced} assignments synced with the exercise` : "assignments already in sync",
  );

  // Enough exercises for the catalog to be a catalog (T-020).
  const fillersCreated = await ensureCatalogExercises(admin.token, g1.id);
  log(
    fillersCreated > 0
      ? `created ${fillersCreated} catalog exercises`
      : "the catalog exercises already existed",
  );

  // A second author, so "only mine" is a filter with two sides (G-018).
  const supervisorExercises = await ensureAuthoredExercises(supervisor1.token, g1.id);
  log(
    supervisorExercises > 0
      ? `created ${supervisorExercises} exercises authored by the supervisor`
      : "the supervisor's own exercises already existed",
  );

  log("done");
  log(
    "NOTE: a solution this script skipped because it already exists keeps whatever evaluation it " +
      "already had. On an instance seeded before evaluation worked at all, those carry an " +
      "infrastructure failure and cannot be refreshed in place -- a re-run of a stored solution " +
      "has no entry point recorded, so core-api refuses it. Delete the solution and re-run this " +
      "script to have it submitted again.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
