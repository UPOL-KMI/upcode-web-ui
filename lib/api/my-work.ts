import "server-only";

import { cache } from "react";

import { requireSession } from "@/lib/auth/require-session";
import { isGradedByPerson } from "@/lib/grading/queue";

import type { SolutionListPayload } from "./assignment-solutions";
import { ApiError, apiGet } from "./client";

export interface MyWork {
  /** Assignments the reader has submitted to at all, an attempt that failed included. */
  attempted: Set<string>;
  /** Assignments whose best solution a person has graded -- the grading queue's rule (DEC-163). */
  graded: Set<string>;
  /** Assignments whose best solution has points a teacher set in place of the evaluation's. */
  overridden: Set<string>;
  /**
   * Assignments whose best solution has points from a person -- overridden or a bonus. What the
   * data-only badge reads ("Ohodnoceno vyučujícím"), the same as `status.graded` on the solution's
   * own screen; a closed review alone is not points (DEC-163).
   */
  pointsSet: Set<string>;
}

/**
 * What the reader has handed in and what a person has graded, per assignment, in one group they
 * study in (X-032). The stats row only knows the *best valid* solution and carries no overridden
 * points or review state, so screens built on it could only guess both. The reader's own solutions
 * answer them in one call; a refusal or failure is null, and the caller falls back to the guess
 * rather than failing the page.
 */
export const getMyWork = cache(async function getMyWork(groupId: string): Promise<MyWork | null> {
  const session = await requireSession();
  try {
    const solutions = await apiGet<(SolutionListPayload & { assignmentId: string })[]>(
      "/v1/groups/{id}/students/{userId}/solutions",
      { pathParams: { id: groupId, userId: session.userId } },
    );
    const best = solutions.filter((solution) => solution.isBestSolution);
    return {
      attempted: new Set(solutions.map((solution) => solution.assignmentId)),
      overridden: new Set(
        best
          .filter((solution) => solution.overriddenPoints !== null)
          .map((solution) => solution.assignmentId),
      ),
      pointsSet: new Set(
        best
          .filter((solution) => solution.overriddenPoints !== null || solution.bonusPoints !== 0)
          .map((solution) => solution.assignmentId),
      ),
      graded: new Set(
        best
          .filter((solution) =>
            isGradedByPerson({
              overridden: solution.overriddenPoints,
              bonus: solution.bonusPoints,
              reviewClosedAt: solution.review?.closedAt ?? null,
            }),
          )
          .map((solution) => solution.assignmentId),
      ),
    };
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
});
