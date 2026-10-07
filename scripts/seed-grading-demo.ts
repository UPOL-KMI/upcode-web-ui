/**
 * One self-contained course for trying X-032 by hand: a student's standing seen from the student's
 * side, the Submitted / Graded columns, the points matrix with its filter, and awarding points for
 * a shadow assignment. Run with `pnpm seed:grading-demo`.
 *
 * Unlike `pnpm seed`, this is meant for an instance that holds real courses: it adds **one** group
 * named `[demo] …` and four `[demo]` students, nothing else, and re-running it reuses all of them.
 * It goes through core-api's HTTP API only, and logs in sequentially (the local PHP-FPM pool is
 * small). `SEED_DEMO_SUPERVISOR_EMAIL` makes that account a supervisor of the group, so the
 * operator can open it under their own name; otherwise only an administrator sees it.
 *
 * The figures each student should show are in `docs/SEED_ACCOUNTS.md` ("Grading demo").
 */

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  API_BASE,
  api,
  createAssignment,
  ensureAssignmentSynced,
  ensureGlobalRole,
  ensureGroupMember,
  ensureStudentMember,
  EXPECTED_OUTPUT,
  findAssignmentsForExercise,
  findGroupByName,
  findSolutionByNote,
  getOrCreateBaseExercise,
  getOrCreateGroup,
  getOrCreateUser,
  log,
  login,
  pickByHint,
  submitSolution,
  type AuthResult,
  type GroupRecord,
} from "./seed-lib";

const DEMO = "[demo]";
const GROUP_NAME = `${DEMO} Hodnocení a stínové úlohy`;
const THRESHOLD_PERCENT = 50;

const CORRECT = [{ name: "solution.py", content: `print("${EXPECTED_OUTPUT.trim()}")\n` }];
const WRONG = [{ name: "solution.py", content: `print("Nope")\n` }];

/** Every assignment is the same exercise; the student hint tells them apart (see `pickByHint`). */
const ASSIGNMENTS = {
  bonus1: { hint: `${DEMO} Bonus 1`, maxPoints: 5, isBonus: true },
  bonus2: { hint: `${DEMO} Bonus 2`, maxPoints: 5, isBonus: true },
  bonus3: { hint: `${DEMO} Bonus 3`, maxPoints: 5, isBonus: true },
  hidden: { hint: `${DEMO} Skrytá úloha`, maxPoints: 10, isPublic: false },
  later: { hint: `${DEMO} Viditelná až za týden`, maxPoints: 10, visibleFromDays: 7 },
} as const;

type AssignmentKey = keyof typeof ASSIGNMENTS;

const SHADOW_COUNT = 10;
const shadowName = (index: number) => `${DEMO} Stínová ${String(index).padStart(2, "0")}`;

const STUDENTS = {
  adam: { email: "adam.demo@demo.recodex.local", firstName: "Adam", lastName: "Demo" },
  bara: { email: "bara.demo@demo.recodex.local", firstName: "Bára", lastName: "Demo" },
  cyril: { email: "cyril.demo@demo.recodex.local", firstName: "Cyril", lastName: "Demo" },
  dana: { email: "dana.demo@demo.recodex.local", firstName: "Dana", lastName: "Demo" },
} as const;

type StudentKey = keyof typeof STUDENTS;

/** A supervisor of the group with a known password, for checking the teacher's side. */
const TEACHER = {
  email: "teacher.demo@demo.recodex.local",
  firstName: "Tereza",
  lastName: "Demo",
  role: "supervisor",
} as const;

interface Submission {
  assignment: AssignmentKey;
  correct: boolean;
  grading?: { overridden?: number; bonus?: number; closeReview?: boolean };
}

/** What each student did. Expected figures: `docs/SEED_ACCOUNTS.md`. */
const PLAN: Record<StudentKey, { submissions: Submission[]; shadows: Record<number, number> }> = {
  adam: {
    submissions: [
      { assignment: "bonus1", correct: true, grading: { overridden: 2 } },
      { assignment: "bonus2", correct: true, grading: { closeReview: true } },
      { assignment: "bonus3", correct: false },
    ],
    shadows: { 1: 5 },
  },
  bara: { submissions: [], shadows: {} },
  cyril: {
    submissions: [{ assignment: "bonus1", correct: false }],
    // A hidden shadow assignment graded ahead of time: shown in the matrix, counted nowhere.
    shadows: { 2: 10 },
  },
  dana: {
    submissions: [
      { assignment: "bonus1", correct: true, grading: { overridden: 5 } },
      { assignment: "bonus2", correct: true, grading: { closeReview: true } },
      { assignment: "bonus3", correct: true, grading: { bonus: 1 } },
    ],
    shadows: { 1: 10 },
  },
};

async function chooseInstance(adminToken: string, supervisorEmail: string | undefined) {
  const instances = await api<{ id: string }[]>("GET", "/instances", { token: adminToken });
  const override = process.env.SEED_INSTANCE_ID;
  if (override) return override;

  if (supervisorEmail) {
    const found = await api<{
      items: { id: string; privateData?: { email?: string; instancesIds?: string[] } }[];
    }>("GET", `/users?filters[search]=${encodeURIComponent(supervisorEmail)}&limit=10&offset=0`, {
      token: adminToken,
    });
    const user = found.items.find((item) => item.privateData?.email === supervisorEmail);
    const instanceId = user?.privateData?.instancesIds?.[0];
    if (!instanceId) throw new Error(`No account ${supervisorEmail} on this deployment.`);
    log(`instance ${instanceId} (where ${supervisorEmail} is)`);
    return instanceId;
  }

  for (const instance of instances) {
    if (await findGroupByName(adminToken, instance.id, GROUP_NAME)) return instance.id;
  }
  const first = instances[0];
  if (!first) throw new Error("GET /instances returned no instances.");
  log(`instance ${first.id} (set SEED_INSTANCE_ID or SEED_DEMO_SUPERVISOR_EMAIL to choose)`);
  return first.id;
}

async function findUserId(adminToken: string, email: string): Promise<string> {
  const found = await api<{ items: { id: string; privateData?: { email?: string } }[] }>(
    "GET",
    `/users?filters[search]=${encodeURIComponent(email)}&limit=10&offset=0`,
    { token: adminToken },
  );
  const user = found.items.find((item) => item.privateData?.email === email);
  if (!user) throw new Error(`No account ${email} on this deployment.`);
  return user.id;
}

/** `actionUpdateGroup` replaces the whole group, so everything it reads goes back with it. */
async function ensureThreshold(adminToken: string, group: GroupRecord) {
  const detail = await api<{
    externalId: string | null;
    public: boolean;
    localizedTexts: { locale: string; name: string; description: string }[];
    privateData: { threshold: number | null; publicStats: boolean; detaining: boolean };
  }>("GET", `/groups/${group.id}`, { token: adminToken });
  if (detail.privateData.threshold === THRESHOLD_PERCENT / 100) return;
  await api("POST", `/groups/${group.id}`, {
    token: adminToken,
    body: {
      localizedTexts: detail.localizedTexts.map((text) => ({
        locale: text.locale,
        name: text.name,
        description: text.description,
      })),
      externalId: detail.externalId ?? "",
      isPublic: detail.public,
      publicStats: detail.privateData.publicStats,
      detaining: detail.privateData.detaining,
      threshold: THRESHOLD_PERCENT,
    },
  });
  log(`threshold set to ${THRESHOLD_PERCENT} %`);
}

/**
 * An assignment displays its exercise's name, so all five would read "[seed] Echo Greeting". The
 * name is overridden after any sync, which would otherwise bring the exercise's texts back.
 */
async function ensureAssignmentName(adminToken: string, assignmentId: string, name: string) {
  const detail = await api<{
    version: number;
    localizedTexts: { locale: string; name: string; text?: string }[];
  }>("GET", `/exercise-assignments/${assignmentId}`, { token: adminToken });
  if (detail.localizedTexts.every((text) => text.name === name)) return;
  const text = detail.localizedTexts[0]?.text ?? "";
  await api("POST", `/exercise-assignments/${assignmentId}/localized-texts`, {
    token: adminToken,
    body: {
      version: detail.version,
      localizedTexts: ["cs", "en"].map((locale) => ({ locale, name, text })),
    },
  });
  log(`assignment named: ${name}`);
}

async function ensureAssignments(adminToken: string, group: GroupRecord, exerciseId: string) {
  const existing = await findAssignmentsForExercise(adminToken, group, exerciseId);
  const ids = {} as Record<AssignmentKey, string>;
  for (const [key, spec] of Object.entries(ASSIGNMENTS) as [
    AssignmentKey,
    (typeof ASSIGNMENTS)[AssignmentKey],
  ][]) {
    const found = pickByHint(existing, spec.hint);
    if (found) {
      await ensureAssignmentSynced(adminToken, found.id);
      await ensureAssignmentName(adminToken, found.id, spec.hint);
      ids[key] = found.id;
      continue;
    }
    const created = await createAssignment(adminToken, exerciseId, group.id, {
      firstDeadlineDays: 14,
      maxPoints: spec.maxPoints,
      hint: spec.hint,
      isBonus: "isBonus" in spec ? spec.isBonus : false,
      isPublic: "isPublic" in spec ? spec.isPublic : true,
      ...("visibleFromDays" in spec && { visibleFromDays: spec.visibleFromDays }),
    });
    await ensureAssignmentName(adminToken, created.id, spec.hint);
    ids[key] = created.id;
  }
  return ids;
}

interface ShadowRecord {
  id: string;
  localizedTexts: { name: string }[];
  points?: { id: string; awardeeId: string }[];
}

async function ensureShadows(adminToken: string, group: GroupRecord): Promise<Map<number, string>> {
  const existing = await api<ShadowRecord[]>("GET", `/groups/${group.id}/shadow-assignments`, {
    token: adminToken,
  });
  const ids = new Map<number, string>();
  for (let index = 1; index <= SHADOW_COUNT; index++) {
    const name = shadowName(index);
    const match = existing.find((shadow) => shadow.localizedTexts.some((t) => t.name === name));
    if (match) {
      ids.set(index, match.id);
      continue;
    }
    const created = await api<{ id: string; version: number }>("POST", "/shadow-assignments", {
      token: adminToken,
      body: { groupId: group.id },
    });
    await api("POST", `/shadow-assignments/${created.id}`, {
      token: adminToken,
      body: {
        version: created.version,
        isPublic: index === 1,
        isBonus: false,
        maxPoints: 10,
        sendNotification: false,
        localizedTexts: [{ locale: "cs", name, text: "Body uděluje vyučující ručně." }],
      },
    });
    ids.set(index, created.id);
    log(`shadow assignment created: ${name}`);
  }
  return ids;
}

async function ensureShadowPoints(
  adminToken: string,
  shadowId: string,
  userId: string,
  points: number,
) {
  const shadow = await api<ShadowRecord>("GET", `/shadow-assignments/${shadowId}`, {
    token: adminToken,
  });
  if (shadow.points?.some((record) => record.awardeeId === userId)) return;
  await api("POST", `/shadow-assignments/${shadowId}/create-points`, {
    token: adminToken,
    body: { userId, points, note: `${DEMO}`, awardedAt: Math.floor(Date.now() / 1000) },
  });
  log(`shadow points awarded: ${points}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Points and a closed review only mean something on an attempt the pipeline has finished. */
async function waitForEvaluation(
  token: string,
  assignmentId: string,
  userId: string,
  note: string,
) {
  for (let attempt = 0; attempt < 45; attempt++) {
    const solutions = await api<
      { note: string; lastSubmission?: { evaluation?: unknown; failure?: unknown } | null }[]
    >("GET", `/exercise-assignments/${assignmentId}/users/${userId}/solutions`, { token });
    const solution = solutions.find((one) => one.note === note);
    if (solution?.lastSubmission?.evaluation || solution?.lastSubmission?.failure) return;
    await sleep(2000);
  }
  throw new Error(`'${note}' was not evaluated within 90 s -- is the worker running?`);
}

async function applyGrading(
  adminToken: string,
  assignmentId: string,
  userId: string,
  note: string,
  grading: NonNullable<Submission["grading"]>,
) {
  const solution = await findSolutionByNote(adminToken, assignmentId, userId, note);
  if (!solution) throw new Error(`no solution noted '${note}'`);
  if (grading.overridden !== undefined || grading.bonus !== undefined) {
    await api("POST", `/assignment-solutions/${solution.id}/bonus-points`, {
      token: adminToken,
      body: { bonusPoints: grading.bonus ?? 0, overriddenPoints: grading.overridden ?? null },
    });
  }
  if (grading.closeReview && solution.review?.closedAt == null) {
    await api("POST", `/assignment-solutions/${solution.id}/review`, {
      token: adminToken,
      body: { close: true },
    });
  }
}

async function main() {
  log(`grading demo against ${API_BASE}`);
  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const supervisorEmail = process.env.SEED_DEMO_SUPERVISOR_EMAIL;
  const instanceId = await chooseInstance(admin.token, supervisorEmail);

  const group = await getOrCreateGroup(admin.token, instanceId, { name: GROUP_NAME });
  await ensureThreshold(admin.token, group);
  if (supervisorEmail) {
    await ensureGroupMember(
      admin.token,
      group,
      await findUserId(admin.token, supervisorEmail),
      "supervisor",
    );
  }

  const teacher = await getOrCreateUser(admin.token, instanceId, TEACHER);
  await ensureGlobalRole(admin.token, teacher.userId, TEACHER.role);
  await ensureGroupMember(admin.token, group, teacher.userId, "supervisor");

  const exercise = await getOrCreateBaseExercise(admin.token, group.id);
  const assignmentIds = await ensureAssignments(admin.token, group, exercise.id);
  const shadowIds = await ensureShadows(admin.token, group);

  const students = {} as Record<StudentKey, AuthResult>;
  for (const key of Object.keys(STUDENTS) as StudentKey[]) {
    students[key] = await getOrCreateUser(admin.token, instanceId, STUDENTS[key]);
    await ensureStudentMember(admin.token, group, students[key].userId);
  }

  for (const key of Object.keys(PLAN) as StudentKey[]) {
    const student = students[key];
    for (const submission of PLAN[key].submissions) {
      const assignmentId = assignmentIds[submission.assignment];
      const note = `${DEMO} ${submission.assignment} ${submission.correct ? "correct" : "wrong"}`;
      await submitSolution(
        student.token,
        student.userId,
        assignmentId,
        note,
        submission.correct ? CORRECT : WRONG,
      );
      if (submission.grading) {
        await waitForEvaluation(admin.token, assignmentId, student.userId, note);
        await applyGrading(admin.token, assignmentId, student.userId, note, submission.grading);
      }
    }
    for (const [index, points] of Object.entries(PLAN[key].shadows)) {
      await ensureShadowPoints(admin.token, shadowIds.get(Number(index))!, student.userId, points);
    }
  }

  log(`done: ${GROUP_NAME} (${group.id})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
