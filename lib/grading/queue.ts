/**
 * The order a teacher grades one assignment in (X-031): who comes before and after the student
 * whose solution is open, and who is the next one nobody has looked at yet.
 *
 * Built from the assignment's own solutions (`/v1/exercise-assignments/{id}/solutions`) rather
 * than from the class table's sources, because that one response already carries everything the
 * queue needs -- the author, core-api's own `isBestSolution`, and the points and review state that
 * decide "graded" -- and the page that asks for it is `cache`d per request.
 *
 * **One entry per student, on their best solution.** A student whose every attempt failed has no
 * best solution and is not in the queue: there is nothing to open, which is the same reason the
 * class table offers them no "grade" link.
 */
export interface GradingEntry {
  userId: string;
  fullName: string;
  /** Their best solution: the one the queue opens for them. */
  solutionId: string;
  graded: boolean;
}

export interface GradingQueue {
  /** One-based, as the bar shows it. */
  position: number;
  total: number;
  previous: GradingEntry | null;
  next: GradingEntry | null;
  /** The nearest student after this one with nothing graded, wrapping round to the start. */
  nextUngraded: GradingEntry | null;
}

interface SolutionForQueue {
  id: string;
  authorId: string;
  authorName: string;
  isBest: boolean;
  overridden: number | null;
  bonus: number;
  reviewClosedAt: number | null;
}

/**
 * Somebody has decided about this solution: set its points by hand, added a bonus, or closed a
 * review on it. The automatic score alone is not a decision -- a teacher who agrees with it says
 * so by closing a review ("mark as reviewed"), which is what takes the student out of the queue.
 *
 * Deliberately not `status.graded` from `lib/api/solution.ts`: that one answers "has a person set
 * points" for the data-only badge, and a closed review is not points.
 */
export function isGradedByPerson(solution: {
  overridden: number | null;
  bonus: number;
  reviewClosedAt: number | null;
}): boolean {
  return solution.overridden !== null || solution.bonus !== 0 || solution.reviewClosedAt !== null;
}

/**
 * Every student with a best solution, in the class table's order. The comparator is the table's
 * own (`getAssignmentSolvers`), so "next" here is the row below in the table; the user id breaks
 * a tie between namesakes so the order cannot change between two page loads.
 */
export function gradingEntries(solutions: readonly SolutionForQueue[]): GradingEntry[] {
  return solutions
    .filter((solution) => solution.isBest)
    .map((solution) => ({
      userId: solution.authorId,
      fullName: solution.authorName,
      solutionId: solution.id,
      graded: isGradedByPerson(solution),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName) || a.userId.localeCompare(b.userId));
}

/**
 * Where `currentUserId` stands in the queue, or null when they are not in it -- which happens for
 * a student none of whose attempts produced a valid solution, opened from their own page.
 */
export function gradingQueue(
  entries: readonly GradingEntry[],
  currentUserId: string,
): GradingQueue | null {
  const index = entries.findIndex((entry) => entry.userId === currentUserId);
  if (index === -1) return null;

  const rotated = [...entries.slice(index + 1), ...entries.slice(0, index)];

  return {
    position: index + 1,
    total: entries.length,
    previous: entries[index - 1] ?? null,
    next: entries[index + 1] ?? null,
    nextUngraded: rotated.find((entry) => !entry.graded) ?? null,
  };
}
