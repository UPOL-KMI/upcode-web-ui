/**
 * Splitting a group total back into "points for the work" and "bonus".
 *
 * **core-api folds them together and offers no way to ask for them apart.** A group's
 * `points.gained` is the sum of `AssignmentSolution::getTotalPoints()`, which is
 * `getPoints() + bonusPoints` (`GroupViewFactory::getPointsGainedByStudentForSolutions`) -- so a
 * student with 20 points and a 5-point bonus reads "25/40" there while every other screen in the
 * app says "20/20 +5". Two numbers for one standing, and the reader has to guess which is which.
 *
 * The per-assignment rows *do* carry the bonus on its own, so the split is a subtraction. Shadow
 * assignments have no bonus at all -- `ShadowAssignmentPoints` is a single figure -- so summing the
 * assignment rows is summing every bonus there is.
 *
 * core-api filters the rows and the totals by the same rule -- what the *reader* may see -- so the
 * subtraction is exact for the reader's own row, which is the only one this is used on. A teacher's
 * view of somebody else's row counts hidden work too; that one is `student-standing.ts`'s job.
 */
export interface GroupPointsInput {
  points: { gained: number; total: number };
  assignments: { points: { bonus?: number | null } }[];
}

export function splitGroupPoints(stats: GroupPointsInput): {
  gained: number;
  bonus: number;
  total: number;
} {
  const bonus = stats.assignments.reduce((sum, row) => sum + (row.points.bonus ?? 0), 0);
  return { gained: stats.points.gained - bonus, bonus, total: stats.points.total };
}
