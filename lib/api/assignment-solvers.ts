import "server-only";

import { cache } from "react";

import { assignmentProgress, type AssignmentProgress } from "@/lib/status/assignment-progress";
import { evaluationStatus, type TestTally } from "@/lib/status/evaluation";

import { getAssignmentSolutions } from "./assignment-solutions";

import { apiPost } from "./client";
import { apiRead } from "./read";
import type { GroupStudentStats } from "./groups";

/**
 * Who has attempted one assignment, and how far they got (S-013).
 *
 * Three responses, none of which is the solutions list itself: `/v1/assignment-solvers` counts
 * attempts per person, `/v1/groups/{id}/students/stats` carries the points core-api awarded for
 * each student's best solution, and `/v1/users/list` puts names on both. Reading
 * `/v1/exercise-assignments/{id}/solutions` instead would answer the same questions and a great
 * deal more -- every attempt by everyone, which is T-003's screen, not this summary.
 *
 * **The roster is the stats response, not the solver list.** A person keeps their solver record
 * after leaving the group, so building rows from solvers alone would report leavers as students
 * and silently omit everyone who has not started -- which is the half of this table a teacher
 * actually reads.
 */
export interface AssignmentSolver {
  userId: string;
  fullName: string;
  /** Attempts core-api counts against the limit; `0` for a student who has not submitted. */
  attempts: number;
  gained: number | null;
  bonus: number | null;
  maxPoints: number;
  bestSolutionId: string | null;
  accepted: boolean;
  reviewRequested: boolean;
  progress: AssignmentProgress;
  /**
   * How many tests their best solution passed, or null where there is no such solution.
   *
   * **Not in the stats row this table is built from.** `/v1/groups/{id}/students/stats` carries a
   * coarse status and the points and nothing per test, so the tally is looked up in the
   * assignment's own solutions by `bestSolutionId`. One extra request for the whole table, on a
   * section already gated on `viewAssignmentSolutions` -- the very permission that endpoint wants
   * -- and already behind its own boundary. Worth it: the operator watched a passing test read as
   * "Špatně" here, and the verdict alone cannot tell them apart.
   */
  tests: TestTally | null;
  /**
   * Their best solution's points were set by a teacher. Looked up beside the tally for the same
   * reason: `/v1/groups/{id}/students/stats` carries the points but not where they came from.
   */
  pointsOverridden: boolean;
  /**
   * Still a student of the group. Someone who has left, or been moved to another group, keeps
   * their solutions here but has no stats row -- see `getAssignmentSolvers` for where their row
   * comes from instead.
   */
  member: boolean;
}

export interface AssignmentSolverSummary {
  students: number;
  submitted: number;
  correct: number;
  reviewRequests: number;
  /** Mean over students with a scored best solution -- `null` when no solution has been scored. */
  averagePoints: number | null;
  maxPoints: number;
}

interface SolverPayload {
  assignmentId: string;
  /** `null` once the author's account is gone -- the solver record outlives them. */
  solverId: string | null;
  lastAttemptIndex: number;
  evaluationsCount: number;
}

export async function getAssignmentSolvers(
  assignmentId: string,
  groupId: string,
  dataOnly = false,
): Promise<AssignmentSolver[]> {
  const [solvers, stats, solutions] = await Promise.all([
    apiRead<SolverPayload[]>("/v1/assignment-solvers", { query: { assignmentId } }),
    apiRead<GroupStudentStats[]>("/v1/groups/{id}/students/stats", { pathParams: { id: groupId } }),
    getAssignmentSolutions(assignmentId),
  ]);
  const talliesBySolution = new Map(solutions.map((solution) => [solution.id, solution.tests]));
  const overriddenSolutions = new Set(
    solutions.filter((solution) => solution.overridden !== null).map((solution) => solution.id),
  );

  const attempts = new Map(solvers.map((solver) => [solver.solverId, solver.lastAttemptIndex]));
  // A solver whose author is gone is not a row. Deleting an account leaves its solutions behind
  // with no author, and `/v1/assignment-solvers` keeps reporting the solver record with
  // `solverId: null` -- which reached the table as a person with no name whose link pointed at
  // `/users/null`, sorted to the top by the empty string, and answered with a refusal when a
  // teacher clicked it.
  const userIds = [...new Set([...stats.map((row) => row.userId), ...attempts.keys()])].filter(
    (userId): userId is string => typeof userId === "string" && userId.length > 0,
  );
  if (userIds.length === 0) return [];

  const people = await apiPost<{ id: string; fullName: string }[]>("/v1/users/list", {
    ids: userIds,
  });
  const names = new Map(people.map((person) => [person.id, person.fullName]));

  return userIds
    .map((userId) => {
      const row = stats
        .find((entry) => entry.userId === userId)
        ?.assignments.find((entry) => entry.id === assignmentId);
      const attemptCount = attempts.get(userId) ?? 0;
      // No stats row: not (or no longer) a student of the group, which core-api's stats only
      // cover. Their row used to be guessed from the attempt count alone, and read "evaluation
      // failed" with no points beside a best solution with ten -- so it is read from that solution,
      // core-api's own `isBestSolution`, the very one the stats would have used.
      if (!row) {
        const best = solutions.find((solution) => solution.authorId === userId && solution.isBest);
        if (best) {
          return {
            userId,
            fullName: names.get(userId) ?? "",
            attempts: attemptCount,
            gained: best.gained,
            bonus: best.bonus,
            maxPoints: best.maxPoints,
            bestSolutionId: best.id,
            tests: best.tests,
            pointsOverridden: best.overridden !== null,
            accepted: best.accepted,
            // core-api's flag is the student's, on any attempt (`findReviewRequestSolutionsIndexed`).
            reviewRequested: solutions.some(
              (solution) => solution.authorId === userId && solution.reviewRequested,
            ),
            progress: evaluationStatus(best.status),
            member: false,
          };
        }
      }
      return {
        userId,
        fullName: names.get(userId) ?? "",
        attempts: attemptCount,
        gained: row?.points.gained ?? null,
        bonus: row?.points.bonus ?? null,
        maxPoints: row?.points.total ?? 0,
        bestSolutionId: row?.bestSolutionId ?? null,
        tests: row?.bestSolutionId ? (talliesBySolution.get(row.bestSolutionId) ?? null) : null,
        pointsOverridden: row?.bestSolutionId ? overriddenSolutions.has(row.bestSolutionId) : false,
        accepted: row?.accepted === true,
        reviewRequested: row?.reviewRequest === true,
        member: row !== undefined,
        // A null status means "no valid best solution", which covers both a student who never
        // started and one whose every attempt died in the pipeline. The attempt count is what
        // tells those apart, and this is the only view that has it -- Q-012 records the dashboard
        // having to guess, and guessing "not submitted" at someone with eleven attempts.
        progress:
          row?.status == null && attemptCount > 0
            ? ("failed" as const)
            : assignmentProgress({
                status: row?.status ?? null,
                gained: row?.points.gained ?? null,
                total: row?.points.total ?? 0,
                accepted: row?.accepted,
                dataOnly,
                pointsOverridden: row?.bestSolutionId
                  ? overriddenSolutions.has(row.bestSolutionId)
                  : false,
                // The stats row has no overridden-points field, so "somebody marked it" is
                // inferred: the data-only judge scores nought, so any points at all came from a
                // person. Documented on `AssignmentProgressInput.graded`.
                graded: (row?.points.gained ?? 0) > 0 || (row?.points.bonus ?? 0) !== 0,
              }),
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function summarizeSolvers(
  solvers: AssignmentSolver[],
  maxPoints: number,
): AssignmentSolverSummary {
  // A submission nobody has marked has no score to average. Its `gained` is the pipeline's nought,
  // and counting it dragged "average points" to 0/20 on an assignment where the teacher had not
  // yet looked at anything -- the same falsehood the row's own badge was telling.
  const scored = solvers.filter(
    (solver) =>
      solver.bestSolutionId !== null &&
      solver.gained !== null &&
      solver.progress !== "awaiting-review",
  );
  return {
    students: solvers.length,
    submitted: solvers.filter((solver) => solver.attempts > 0).length,
    correct: solvers.filter((solver) => solver.progress === "correct").length,
    reviewRequests: solvers.filter((solver) => solver.reviewRequested).length,
    averagePoints:
      scored.length === 0
        ? null
        : scored.reduce((sum, solver) => sum + (solver.gained ?? 0), 0) / scored.length,
    maxPoints,
  };
}

export const getAssignmentSolverSummary = cache(async function getAssignmentSolverSummary(
  assignmentId: string,
  groupId: string,
  maxPoints: number,
  dataOnly = false,
): Promise<{ solvers: AssignmentSolver[]; summary: AssignmentSolverSummary }> {
  const solvers = await getAssignmentSolvers(assignmentId, groupId, dataOnly);
  return { solvers, summary: summarizeSolvers(solvers, maxPoints) };
});
