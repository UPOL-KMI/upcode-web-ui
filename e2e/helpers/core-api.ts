import { STUDENT, SUPERADMIN } from "./accounts";
import type { SeedAccount } from "./accounts";

/**
 * Where core-api itself answers, for the one thing this harness cannot get from the app.
 *
 * Same shape as `base-url.ts`: a default that matches `.env.local`'s `API_BASE_PUBLIC` on a local
 * `docker compose` stack, overridable for a deployment that publishes it elsewhere. Playwright
 * does not load `.env.local` (only the app under test does), so this cannot simply read it.
 */
export const coreApiBase = process.env.PLAYWRIGHT_API_BASE ?? "http://localhost/api/v1";

/**
 * The group the seed populates.
 *
 * Named in one place because a helper that searches the *whole* deployment finds whatever an
 * operator has in their own courses first, and reports it as a fixture. `seededAttemptsOfOneAuthor`
 * did exactly that: it walked every group and returned two attempts on an assignment inside
 * somebody's `Jazyk Python`, left by a seed run that predates `chooseInstance` -- so the spec that
 * needs the seed's multi-file submission got two plain ones and failed on the fixture (PF-013).
 */
export const SEEDED_GROUP_NAME = "[seed] Intro to Programming";

/** Notes the seed puts on the solutions it submits, so a spec can name the one it means to act on
 *  rather than taking whichever is first. */
export const SEEDED_WRONG_NOTE = "[seed] wrong";
export const SEEDED_MULTI_FILE_NOTE = "[seed] multi-file";
export const SEEDED_CORRECT_NOTE = "[seed] correct";

async function seededGroup(token: string): Promise<{
  id: string;
  privateData?: { assignments?: string[]; students?: string[] };
}> {
  const groups = await coreApi<
    {
      id: string;
      localizedTexts?: { name?: string }[];
      privateData?: { assignments?: string[]; students?: string[] };
    }[]
  >("/groups", token);
  const matches = groups.filter((one) =>
    (one.localizedTexts ?? []).some((text) => text.name === SEEDED_GROUP_NAME),
  );
  if (matches.length === 0)
    throw new Error(`the seeded group '${SEEDED_GROUP_NAME}' is not on this instance`);
  if (matches.length > 1)
    throw new Error(
      `${matches.length} groups are named '${SEEDED_GROUP_NAME}' -- an earlier seed run left a ` +
        `duplicate, and no helper can tell which one the specs mean`,
    );
  return matches[0]!;
}

/** The seeded course's id, for the specs that only need somewhere to point at. */
export async function seededGroupId(): Promise<string> {
  return (await seededGroup(await coreApiToken())).id;
}

/**
 * The id of the seeded student who is *not* the one the specs sign in as (PF-013).
 *
 * A spec asserted a refusal against a hardcoded UUID, which belonged to Bob in a database that has
 * since been re-seeded -- so it was asking for somebody who does not exist and getting "Page not
 * found" where it expected "Forbidden". Both answers are correct for what was asked; only one of
 * them is the thing the test is about.
 */
export async function seededClassmateId(fullName = "Bob Classmate"): Promise<string> {
  const token = await coreApiToken();
  const group = await seededGroup(token);
  const ids = group.privateData?.students ?? [];
  const response = await fetch(`${coreApiBase}/users/list`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const body = (await response.json()) as {
    success: boolean;
    payload: { id: string; fullName: string }[];
  };
  if (!response.ok || !body.success) throw new Error(`core-api POST /users/list failed`);
  const person = body.payload.find((one) => one.fullName === fullName);
  if (!person) throw new Error(`'${fullName}' is not a student of the seeded group`);
  return person.id;
}

async function coreApi<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${coreApiBase}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as { success: boolean; payload: T; error?: unknown };
  if (!response.ok || !body.success) {
    throw new Error(`core-api GET ${path} failed: HTTP ${response.status}`);
  }
  return body.payload;
}

/**
 * Delete a pipeline directly, for a spec's own cleanup (T-015/T-016).
 *
 * **The only write in this helper, and it exists because a failing spec left forks behind.** A
 * pipeline the suite created is the suite's to remove, and a test that dies before its own
 * teardown must not leave the instance's list growing -- the next run then finds two pipelines of
 * one name and its `.first()` picks whichever. Returns quietly if the pipeline is already gone,
 * which is the ordinary case when the test's own deletion succeeded.
 */
export async function deletePipelineIfPresent(pipelineId: string): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/pipelines/${pipelineId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * Delete an assignment directly, for a spec's own cleanup (T-012).
 *
 * Sibling of `deletePipelineIfPresent`, and for the same reason: an assignment made from a seeded
 * exercise **inherits that exercise's name**, so one left behind by a failed run is invisible to
 * any name-based sweep and simply accumulates. A spec that creates one owns it whether or not it
 * reaches its own teardown.
 */
export async function deleteAssignmentIfPresent(assignmentId: string): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/exercise-assignments/${assignmentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * Delete a group directly, for a spec's own cleanup (AD-004).
 *
 * Third of its kind, and the reason is core-api's rather than a spec's carelessness: deleting an
 * **instance** does not delete its root group (Q-023), so a spec that creates an instance and
 * removes it again still leaves a group behind -- listed among the groups and, because the creator
 * administers it, in the sidebar of every superadmin page. Eight of them had accumulated before
 * anybody looked at a sidebar.
 */
export async function deleteGroupIfPresent(groupId: string): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/groups/${groupId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * Delete an exercise directly, for a spec's own cleanup (PF-007).
 *
 * Fourth of its kind, and the one whose absence was already costing something. `exercise-edit.spec`
 * created a real exercise and deleted it at the end of the test body rather than in a hook, so any
 * failure in between left it behind -- and **four had accumulated on the development instance**,
 * all named "Exercise by Sam Supervisor", all with no difficulty, indistinguishable from a fixture.
 * They were what made G-031b's empty-difficulty cell look like seeded data when it was detritus.
 *
 * An orphan here is worse than a stray pipeline, because a new exercise is named after its author
 * rather than by the spec: there is no `[e2e]` prefix to sweep on, and nothing tells one apart from
 * an exercise a real supervisor started and abandoned. So it has to be removed by id, by whoever
 * created it, whether or not their test survived.
 */
/**
 * Delete the account with this address, for a spec's own cleanup (PF-014).
 *
 * **By address rather than by id**, because the screen that creates an account does not put its id
 * anywhere the test can read before the assertions that follow -- and the address is what the test
 * already holds, since it has to mint a unique one per run (Q-021: a soft-deleted address can never
 * be deleted a second time).
 */
export async function deleteUserByEmailIfPresent(email: string): Promise<void> {
  const token = await coreApiToken();
  const found = await coreApi<{
    items?: { id: string; privateData?: { email?: string } }[];
  }>(`/users?filters[search]=${encodeURIComponent(email)}`, token).catch(() => ({ items: [] }));
  for (const user of found.items ?? []) {
    // The address is under `privateData`, not on the item -- the list discloses a name to anyone
    // who may read it and an address only to a caller who may see that. An exact match, because
    // core-api's `search` is a substring one and this must not delete a neighbour.
    if (user.privateData?.email !== email) continue;
    await fetch(`${coreApiBase}/users/${user.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
}

/**
 * Delete an instance and the root group deleting it leaves behind, for a spec's own cleanup
 * (PF-014).
 *
 * The second half is not tidiness: **deleting an instance orphans its root group** (Q-023), and an
 * orphaned root group lands in the sidebar of every superadmin page on the deployment. So a
 * teardown that removed only the instance would still leave a visible trace of every run.
 *
 * Written against core-api rather than the screen on purpose. The spec's own delete goes through
 * the dialog, which is what it asserts; this one has to work when the page is the thing that died.
 */
export async function deleteInstanceIfPresent(instanceId: string): Promise<void> {
  const token = await coreApiToken();
  const instance = await coreApi<{ rootGroupId?: string | null }>(
    `/instances/${instanceId}`,
    token,
  ).catch(() => null);
  await fetch(`${coreApiBase}/instances/${instanceId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
  if (instance?.rootGroupId) await deleteGroupIfPresent(instance.rootGroupId);
}

/**
 * Remove every `[e2e] `-noted group invitation, for the file that creates them (PF-014).
 *
 * The same shape as `deleteE2eSystemMessages` and for the same reason: the notes are this suite's
 * own, nothing else writes them, and a link left behind by a run that died is offered to anyone who
 * opens the group's settings. Indiscriminate on purpose -- a run that never reached its own
 * teardown cannot say which links it made.
 */
export async function deleteE2eGroupInvitations(): Promise<void> {
  const token = await coreApiToken();
  const groups = await coreApi<{ id: string }[]>("/groups?archived=true", token);
  for (const group of groups) {
    const invitations = await coreApi<{ id: string; note: string | null }[]>(
      `/groups/${group.id}/invitations`,
      token,
    ).catch(() => []);
    for (const invitation of invitations) {
      if (!invitation.note?.startsWith("[e2e] ")) continue;
      await fetch(`${coreApiBase}/group-invitations/${invitation.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
  }
}

/**
 * Every configuration variable of an exercise, flattened, for a spec that has to assert what was
 * written rather than what a form shows (X-001).
 *
 * The configuration is nested three deep -- environment, test, pipeline -- and a variable's meaning
 * comes from its name, not its position, so this flattens to `{name, value}` pairs and lets the
 * caller look for the ones it cares about. Read straight from core-api because the screen shows
 * one test's configuration at a time: an import writes several, and what matters is that each
 * knows its own two files.
 */
export async function exerciseConfigVariables(
  exerciseId: string,
): Promise<{ name: string; value: unknown }[]> {
  const token = await coreApiToken();
  const config = await coreApi<
    { tests?: { pipelines?: { variables?: { name: string; value: unknown }[] }[] }[] }[]
  >(`/exercises/${exerciseId}/config`, token);
  return config.flatMap((environment) =>
    (environment.tests ?? []).flatMap((test) =>
      (test.pipelines ?? []).flatMap((pipeline) => pipeline.variables ?? []),
    ),
  );
}

export async function deleteExerciseIfPresent(exerciseId: string): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/exercises/${exerciseId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * Delete every system message whose text this suite wrote, whatever run left it there.
 *
 * **Swept by text rather than tracked by id, which is the opposite of `deleteExerciseIfPresent`
 * above, and the difference is what the message *is*.** An orphaned exercise is invisible until
 * somebody opens the catalog; an orphaned broadcast is rendered above `{children}` on every
 * authenticated page for every persona, so one survivor puts a banner inside `<main>` and fails
 * every other spec that reads it. Twenty-five had accumulated before anybody counted, from runs
 * whose own teardown never got to run, and they turned the whole suite red at once.
 *
 * Sweeping is safe here where it was not for exercises: these carry `e2e ` in the text the spec
 * itself wrote, so an orphan is identifiable, and no real deployment message begins that way.
 * `/notifications/all` is the management list -- every message that exists, not just the ones
 * currently live -- so a queued or expired orphan is caught too.
 */
export async function deleteE2eSystemMessages(): Promise<void> {
  const token = await coreApiToken();
  const all = await coreApi<{ id: string; localizedTexts: { text: string }[] }[]>(
    "/notifications/all",
    token,
  ).catch(() => []);

  for (const message of all) {
    if (!message.localizedTexts.some((text) => text.text.startsWith("e2e "))) continue;
    await fetch(`${coreApiBase}/notifications/${message.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
}

async function coreApiToken(): Promise<string> {
  const response = await fetch(`${coreApiBase}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: SUPERADMIN.email, password: SUPERADMIN.password }),
  });
  if (!response.ok) throw new Error(`core-api login failed: HTTP ${response.status}`);
  const body = (await response.json()) as { payload: { accessToken: string } };
  return body.payload.accessToken;
}

/**
 * A seeded solution that has **no review yet** (G-003).
 *
 * Distinct from `firstSeededSolution` on purpose: the seed opens a review on its first solution, and
 * asking for a review is deliberately not offered once one exists -- so a test of the request
 * control that used the first solution would be asserting against the guard rather than the
 * control. Found rather than pinned, for the same reason as its neighbour.
 *
 * **A pending review request disqualifies a solution too, and that is not fussiness.** Every caller
 * of this helper *toggles* the request flag and puts it back to `false`, and the seed's own
 * `[seed] correct` carries a request as a fixture -- the row the teacher dashboard and the
 * plagiarism spec both walk. Handing that solution out here silently cleared it, so those two
 * failed depending on which worker finished first (PF-013).
 */
export async function seededSolutionWithoutReview(
  account: SeedAccount = STUDENT,
): Promise<{ id: string; authorId: string }> {
  const token = await coreApiToken();
  const group = await seededGroup(token);
  // **This reader's own**, because the control this is for is theirs to press: a student may ask
  // for a review of their own solution and nobody else's, so handing back a classmate's left the
  // button they wait for on a page they are refused.
  const own = await accountUserId(account);
  for (const assignmentId of group.privateData?.assignments ?? []) {
    const solutions = await coreApi<
      { id: string; authorId: string; review: unknown | null; reviewRequest?: boolean }[]
    >(`/exercise-assignments/${assignmentId}/solutions`, token);
    const clean = solutions.find(
      (solution) =>
        solution.authorId === own && solution.review === null && solution.reviewRequest !== true,
    );
    if (clean) return { id: clean.id, authorId: clean.authorId };
  }
  throw new Error(`no unreviewed solution of ${account.email} in '${SEEDED_GROUP_NAME}'`);
}

/** The account's own user id, from the login response core-api answers with. */
async function accountUserId(account: SeedAccount): Promise<string> {
  const response = await fetch(`${coreApiBase}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: account.email, password: account.password }),
  });
  const body = (await response.json()) as {
    success: boolean;
    payload: { user: { id: string } };
  };
  if (!response.ok || !body.success) throw new Error(`could not sign in as ${account.email}`);
  return body.payload.user.id;
}

/**
 * The solution the seed has opened a review on (PF-013).
 *
 * Named by the state rather than by position. `firstSeededSolution()` was standing in for this,
 * and "the first solution of the first assignment that has any" is not the same thing -- on a
 * deployment where an operator's own course sorts first it was a solution with no review at all,
 * so the spec asserting "asking for a review is not offered once one exists" was reading a screen
 * where one did not.
 */
/**
 * The seeded solution the similarity fixture is recorded against (PF-013).
 *
 * On the **primary** assignment specifically. `plagiarism.spec.ts` used to walk the teacher's
 * review queue and take the first row that offered a "Similarities" link, which is a coin toss on
 * an instance carrying a second flagged solution from an earlier run -- and the loser is a report
 * whose match points at a deleted account, so the screen renders nothing and the failure looks
 * like a product defect. The queue is still asserted to lead here; it just no longer decides
 * *which* solution the report is read on.
 */
export async function seededFlaggedSolution(): Promise<{ id: string }> {
  const token = await coreApiToken();
  const { primary } = await seededAssignments();
  const solutions = await coreApi<{ id: string; plagiarism?: string | null }[]>(
    `/exercise-assignments/${primary}/solutions`,
    token,
  );
  const flagged = solutions.find((one) => one.plagiarism != null);
  if (!flagged)
    throw new Error("no flagged solution on the seeded primary assignment -- run `pnpm seed`");
  return { id: flagged.id };
}

export async function seededSolutionWithOpenReview(): Promise<{ id: string }> {
  const token = await coreApiToken();
  const group = await seededGroup(token);
  for (const assignmentId of group.privateData?.assignments ?? []) {
    const solutions = await coreApi<{ id: string; review: { closedAt: number | null } | null }[]>(
      `/exercise-assignments/${assignmentId}/solutions`,
      token,
    );
    const reviewed = solutions.find((solution) => solution.review !== null);
    if (reviewed) return { id: reviewed.id };
  }
  throw new Error(`no solution with a review in '${SEEDED_GROUP_NAME}' -- run \`pnpm seed\``);
}

/** Set or clear a solution's review request without going through a screen, for teardown (G-003). */
/**
 * Puts the seed's review request back where the seed leaves it (PF-013).
 *
 * **`reviewRequest` is unique per author and assignment, and core-api enforces that by clearing it
 * everywhere else** (`AssignmentSolutionsPresenter::actionSetFlag`). So asking for a review on one
 * of a student's attempts silently withdraws the request from another of theirs -- and one of
 * those is the seed's fixture, the row the teacher dashboard and the plagiarism report are both
 * found through. Clearing the flag that was set is not the same as restoring what it displaced,
 * which is why this exists as well as the specs writing on the classmate.
 */
/**
 * Erase the review on a solution, for a spec's own cleanup (PF-014).
 *
 * `solution-sources.spec.ts` starts a supervisor's review, closes it, and erases it at the end of
 * the test body -- so a failure in between leaves a review standing, and the next run finds no
 * "Start review" button because the review it wanted to start is already there. That is the leak
 * biting its own spec rather than a neighbour's, which is how it was found.
 *
 * Erasing also does not restore the `reviewRequest` that closing the review cleared, which is why
 * the caller pairs this with `restoreSeededReviewRequest` (DEC-133).
 */
export async function eraseReviewIfPresent(solutionId: string): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/assignment-solutions/${solutionId}/review`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

export async function restoreSeededReviewRequest(): Promise<void> {
  const { id } = await firstSeededSolution(SEEDED_CORRECT_NOTE);
  await setReviewRequestedDirectly(id, true);
}

export async function setReviewRequestedDirectly(
  solutionId: string,
  value: boolean,
): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/assignment-solutions/${solutionId}/set-flag/reviewRequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  }).catch(() => undefined);
}

/**
 * The submission ids a solution currently has (G-002).
 *
 * A resubmit adds one to the *same* solution rather than creating a new one, so a spec that
 * re-runs a seeded solution has to know which submissions were there before in order to put it
 * back. Pairs with `deleteSubmissionIfPresent`.
 */
export async function solutionSubmissionIds(solutionId: string): Promise<string[]> {
  const token = await coreApiToken();
  const solution = await coreApi<{ submissions: string[] }>(
    `/assignment-solutions/${solutionId}`,
    token,
  );
  return solution.submissions;
}

/**
 * Make an evaluation failure of this suite's own, and hand back the job id the screen shows it by
 * (PF-006).
 *
 * **Written because the suite was quietly draining a shared queue.** The resolve test used to take
 * whatever unresolved failure was oldest, on the reasoning that this instance mints a fresh one
 * every time the submit spec runs -- which stopped being true when that spec started deleting the
 * solution it submits, because deleting a solution takes its failures with it. Resolving is
 * permanent (core-api has no un-resolve), so the queue drained by one per run until it was empty
 * and three tests went red for a reason that had nothing to do with them.
 *
 * A re-run of a seeded solution used to be the cheapest honest way to mint one: the sandbox could
 * not run at all, so every job failed within a second. **That is no longer true** -- evaluation
 * works, and a re-run now produces an ordinary verdict. Nothing this suite can reach from core-api
 * makes a job fail on purpose any more: it takes a hardware group no worker serves, and this
 * deployment defines exactly one -- and **that group cannot be created**, since
 * `/v1/hardware-groups` is a lone `GET`. PF-017 investigated both routes out of this and closed:
 * nothing reachable from an API a spec can call produces a submission failure, because a
 * submission failure is by definition what the broker or the worker could not do. So the tests
 * that need a row say why they cannot run.
 *
 * Returns `null` rather than throwing, so the caller skips rather than fails: the screen is fine,
 * the fixture is missing.
 */
export async function mintSubmissionFailure(): Promise<{
  submissionId: string;
  jobId: string;
} | null> {
  const token = await coreApiToken();
  // Its own solution, named. Three specs resubmit "the first seeded solution" and they run in
  // parallel -- one adding a run while another counts them is a failure with no defect behind it
  // (PF-013).
  const { id } = await firstSeededSolution(SEEDED_MULTI_FILE_NOTE);
  const before = new Set(await solutionSubmissionIds(id));

  const response = await fetch(`${coreApiBase}/assignment-solutions/${id}/resubmit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ debug: false }),
  });
  if (!response.ok) throw new Error(`could not resubmit: HTTP ${response.status}`);

  // Short, because the expected answer is now "there is no failure": the run is evaluated instead.
  // Long enough that a deployment whose sandbox really is broken still mints one here.
  for (let attempt = 0; attempt < 10; attempt++) {
    const added = (await solutionSubmissionIds(id)).filter((one) => !before.has(one));
    const submissionId = added[0];
    if (submissionId !== undefined) {
      const failures = await coreApi<
        { id: string; description: string; resolvedAt: number | null }[]
      >("/submission-failures", token);
      // The job id core-api names in the description **is** the submission's own id, which is what
      // makes the row findable on a screen where every failure reads alike.
      if (failures.some((failure) => failure.description.includes(submissionId))) {
        return { submissionId, jobId: submissionId };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // The run that did not fail is still a run, and leaving it behind is what PF-011 was about.
  const added = (await solutionSubmissionIds(id)).filter((one) => !before.has(one));
  for (const submissionId of added) await deleteSubmissionIfPresent(submissionId);
  return null;
}

/** Delete one evaluation run of a solution, for a spec that caused an extra one (G-002). */
export async function deleteSubmissionIfPresent(submissionId: string): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/assignment-solutions/submission/${submissionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * Delete a solution a spec submitted, for its own cleanup.
 *
 * **Added because the submit test was not idempotent.** It uploads a real file and creates a real
 * solution every run, and removed none of them -- so Alice's attempt count grew by one per full
 * suite run until `assignment-solutions.spec.ts`'s `toHaveCount(3)` stopped being true. That is the
 * suite reporting on its own history rather than on the app. Returns quietly if it is already gone.
 */
export async function deleteSolutionIfPresent(solutionId: string): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/assignment-solutions/${solutionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * Several attempts by one student at one assignment, oldest first (G-005).
 *
 * The comparison screen needs two solutions by the **same author**, which is what it offers to
 * compare; the seed leaves three under its primary assignment and their contents genuinely differ.
 * Found rather than pinned, like its neighbours.
 */
export async function seededAttemptsOfOneAuthor(): Promise<
  { id: string; attemptIndex: number; note: string }[]
> {
  const token = await coreApiToken();
  const group = await seededGroup(token);
  for (const assignmentId of group.privateData?.assignments ?? []) {
    const solutions = await coreApi<
      { id: string; attemptIndex: number; note: string; authorId: string | null }[]
    >(`/exercise-assignments/${assignmentId}/solutions`, token);
    const byAuthor = new Map<string, typeof solutions>();
    for (const solution of solutions) {
      // An authorless solution is what a deleted account leaves behind, and grouping them
      // together would invent an "author" with several attempts.
      if (solution.authorId === null) continue;
      byAuthor.set(solution.authorId, [...(byAuthor.get(solution.authorId) ?? []), solution]);
    }
    for (const attempts of byAuthor.values()) {
      if (attempts.length >= 2) {
        return [...attempts]
          .sort((a, b) => a.attemptIndex - b.attemptIndex)
          .map(({ id, attemptIndex, note }) => ({ id, attemptIndex, note }));
      }
    }
  }
  throw new Error(`no author with two attempts at one assignment in '${SEEDED_GROUP_NAME}'`);
}

/**
 * The three assignments the seed makes from `[seed] Echo Greeting` in one group, told apart
 * (PF-010).
 *
 * **They all render the same label, because an assignment is displayed by its *exercise's* name**,
 * and the seed creates three from one exercise on purpose (F-029). So
 * `getByRole("link", {name: "[seed] Echo Greeting"}).first()` picks whichever the table happens to
 * sort first -- and the specs that did that needed *different* ones of the three: the edit spec
 * asserts a second deadline is present, the solutions spec asserts submissions are listed. Both
 * passed on one instance and failed on another for no better reason than the order.
 *
 * Told apart by what the seed guarantees rather than by position. The second-deadline one is the
 * only assignment **anywhere** with one, which the seed says in as many words. The unsubmitted one
 * is named by its student hint -- not by counting its solutions, because that is exactly the
 * property that drifts: earlier suite runs have submitted to it, and this helper has to keep
 * working on an instance where they did.
 */
export async function seededAssignments(): Promise<{
  primary: string;
  unsubmitted: string;
  secondDeadline: string;
}> {
  const token = await coreApiToken();
  const group = await seededGroup(token);

  const assignments = [];
  for (const id of group.privateData?.assignments ?? []) {
    const detail = await coreApi<{
      allowSecondDeadline?: boolean;
      localizedTexts?: { studentHint?: string }[];
    }>(`/exercise-assignments/${id}`, token);
    assignments.push({
      id,
      secondDeadline: detail.allowSecondDeadline === true,
      hint: (detail.localizedTexts ?? []).map((text) => text.studentHint ?? "").join(" "),
    });
  }

  const secondDeadline = assignments.find((one) => one.secondDeadline);
  const unsubmitted = assignments.find((one) => one.hint.startsWith("Nothing submitted yet"));
  const primary = assignments.find((one) => one !== secondDeadline && one !== unsubmitted);
  if (!secondDeadline || !unsubmitted || !primary) {
    throw new Error(
      `the seeded group does not hold the three expected assignments (found ${assignments.length}; ` +
        `run \`pnpm seed\`)`,
    );
  }
  return { primary: primary.id, unsubmitted: unsubmitted.id, secondDeadline: secondDeadline.id };
}

/**
 * Every instance name this deployment publishes (PF-010).
 *
 * `/v1/instances` is granted to the unauthenticated role, which is how the landing page and the
 * registration form both read it -- so this asks the same question the app asks, with no token.
 *
 * It exists because a spec hardcoded one name. **This deployment has two instances and the endpoint
 * promises no ordering**, so which one the landing page names is not a fact about the app; a test
 * that pins it is testing the order core-api happened to return.
 */
export async function deploymentInstanceNames(): Promise<string[]> {
  const response = await fetch(`${coreApiBase}/instances`);
  const body = (await response.json()) as {
    success: boolean;
    payload: { name?: string }[];
  };
  if (!response.ok || !body.success) {
    throw new Error(`core-api GET /instances failed: HTTP ${response.status}`);
  }
  const names = body.payload.map((one) => one.name ?? "").filter((name) => name !== "");
  if (names.length === 0) throw new Error("this deployment publishes no instances");
  return names;
}

/** Delete a shadow assignment a spec created, for its own cleanup (G-009). */
export async function deleteShadowAssignmentIfPresent(shadowId: string): Promise<void> {
  const token = await coreApiToken();
  await fetch(`${coreApiBase}/shadow-assignments/${shadowId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

/**
 * A seeded solution to act on, and the assignment maximum it is scored against (G-001).
 *
 * Found rather than hardcoded: `scripts/seed.ts` does not publish solution ids, and pinning one
 * would break the moment the seed changed. Returns the first solution of the first seeded
 * assignment that has any, which is stable for a given seeded database and is all the caller needs.
 */
export async function firstSeededSolution(note?: string): Promise<{
  id: string;
  maxPoints: number;
}> {
  const token = await coreApiToken();
  // The **primary** assignment, which is where the seed puts every solution it submits. Searching
  // the group -- let alone the deployment, which this did -- means "the first solution of the
  // first assignment that has any", and that was a solution in an operator's own course.
  const { primary } = await seededAssignments();
  const solutions = await coreApi<{ id: string; maxPoints: number; note?: string }[]>(
    `/exercise-assignments/${primary}/solutions`,
    token,
  );
  const found = note === undefined ? solutions[0] : solutions.find((one) => one.note === note);
  if (found) return { id: found.id, maxPoints: found.maxPoints };
  throw new Error(
    note === undefined
      ? `the seeded primary assignment has no solutions -- run \`pnpm seed\``
      : `no solution noted '${note}' on the seeded primary assignment -- run \`pnpm seed\``,
  );
}

/**
 * Put a solution's teacher-set fields back where the seed leaves them (G-001).
 *
 * The verdict spec mutates a *seeded* solution rather than creating one, because on this host no
 * evaluation can succeed (DEC-031) and a freshly submitted solution is in a state no teacher ever
 * sees. That makes restoring it the price, and it belongs here beside the other teardowns rather
 * than in the spec.
 */
export async function restoreSolutionVerdict(solutionId: string): Promise<void> {
  const token = await coreApiToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  await fetch(`${coreApiBase}/assignment-solutions/${solutionId}/set-flag/accepted`, {
    method: "POST",
    headers,
    body: JSON.stringify({ value: false }),
  }).catch(() => undefined);
  await fetch(`${coreApiBase}/assignment-solutions/${solutionId}/bonus-points`, {
    method: "POST",
    headers,
    body: JSON.stringify({ bonusPoints: 0, overriddenPoints: null }),
  }).catch(() => undefined);
}

/**
 * The ids of the seeded group invitations, keyed by their seed note (S-023).
 *
 * **The only fixture in this suite fetched from core-api rather than found in the app**, and
 * deliberately so: an invitation id reaches its recipient out of band -- in an email, or pasted
 * into a chat -- so there is no screen a *recipient* could read it from.
 *
 * T-018 built the minting side, and the S-023 row expected that to retire this helper. It does
 * not, quite: two of the five seeded fixtures are on groups whose settings tab shows no invitation
 * section at all -- an organizational group cannot be joined, so the section is hidden there, and
 * so the only way to a link on one is this. What T-018 did change is that the *ordinary* case is
 * now clickable, which is what `group-invitations.spec.ts`'s management test exercises.
 *
 * Called once per spec file (`test.beforeAll`), not per test -- core-api's login is bcrypt-slow,
 * which is the same reason `loginAndGetCookie` is called once per persona.
 */
export async function seededInvitationIds(): Promise<Map<string, string>> {
  const token = await coreApiToken();
  const groups = await coreApi<{ id: string }[]>("/groups?archived=true", token);

  const found = new Map<string, string>();
  for (const group of groups) {
    const invitations = await coreApi<{ id: string; note: string | null }[]>(
      `/groups/${group.id}/invitations`,
      token,
    );
    for (const invitation of invitations) {
      if (invitation.note?.startsWith("[seed] ")) found.set(invitation.note, invitation.id);
    }
  }
  return found;
}

/**
 * Delete a reference solution a spec submitted, by the description it gave it (PF-016).
 *
 * **Sixth entity to need this**, after PF-007's exercises, PF-011's solutions and PF-014's four --
 * and this one bit its own next run rather than a neighbour's, which is the hardest kind to read.
 * `reference-solutions.spec.ts` submits one as the supervisor and deletes it as its last assertion;
 * a failure before that leaves it behind, and because it is now **the supervisor's own**, the next
 * run's "a colleague's private answers are not this reader's" assertion sees a list with one row in
 * it and fails on the fixture rather than on the app.
 *
 * By description rather than by id, for PF-014's reason: the screen does not put the new id
 * anywhere the test can read, and the description is what the test already holds.
 */
export async function deleteReferenceSolutionByDescription(description: string): Promise<void> {
  const token = await coreApiToken();
  const exerciseId = await seededExerciseId(token);
  const solutions = await coreApi<{ id: string; description: string }[]>(
    `/reference-solutions/exercise/${exerciseId}`,
    token,
  ).catch(() => []);
  for (const solution of solutions.filter((one) => one.description === description)) {
    await fetch(`${coreApiBase}/reference-solutions/${solution.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
}

/** The seeded exercise every assignment in the seeded group is made from. */
async function seededExerciseId(token: string): Promise<string> {
  const { primary } = await seededAssignments();
  const assignment = await coreApi<{ exerciseId: string }>(
    `/exercise-assignments/${primary}`,
    token,
  );
  return assignment.exerciseId;
}

/**
 * The name this deployment's instance goes by, read rather than assumed.
 *
 * **Hardcoded as "Frankenstein University, Atlantida" in five tests until plan 003**, which is
 * upstream's own fixture text and stopped being true the moment a deployment named itself
 * (`RECODEX_INSTANCE_NAME`). The instance's name is also its root group's, so the same string is
 * what the group list, the command palette and the instances screen all show -- five failures from
 * one rename, on a database that was simply seeded by a different operator.
 *
 * `/v1/instances` is granted to the unauthenticated reader, which is what the landing page relies
 * on (PF-010 fixed that one the same way); this asks with a token anyway, since every caller has
 * one.
 */
export async function instanceName(): Promise<string> {
  const token = await coreApiToken();
  const instances = await coreApi<{ name: string }[]>("/instances", token);
  const first = instances[0];
  if (!first) throw new Error("this deployment has no instance at all");
  return first.name;
}
