/**
 * Where a student stands in a group **as the student sees it** (X-032, DEC-165).
 *
 * core-api's `/v1/groups/{id}/students/stats` filters assignments by the *reader's* permissions
 * (`GroupViewFactory::getAssignments`), so a teacher gets a student's row with every hidden
 * assignment and hidden shadow assignment counted into the maximum -- and a percentage threshold
 * judged against that maximum. The student's own row has neither. This recomputes the figures
 * from the per-item rows the same response carries, keeping only what the student can see, so the
 * two readers see one standing.
 *
 * The sums are core-api's own: gained is the best solution's points plus its bonus
 * (`AssignmentSolution::getTotalPoints`) plus shadow points; the maximum leaves bonus work out
 * (`AssignmentBase::getGroupPoints`).
 */
export interface StandingItem {
  /** What it is worth -- `maxPointsBeforeFirstDeadline` for an assignment, `maxPoints` for a shadow. */
  maxPoints: number;
  isBonus: boolean;
  /** The student can see it; see `isStudentVisible`. */
  visible: boolean;
}

export interface StandingStats {
  assignments: {
    id: string;
    points: { gained: number | null; bonus: number | null };
    bestSolutionId: string | null;
  }[];
  shadowAssignments: { id: string; points: { gained: number | null } }[];
}

export interface StandingInput {
  stats: StandingStats;
  assignments: ReadonlyMap<string, StandingItem>;
  shadows: ReadonlyMap<string, StandingItem>;
  threshold: number | null;
  pointsLimit: number | null;
  /** Assignments this student has at least one attempt at; null where the reader cannot ask. */
  attempted: ReadonlySet<string> | null;
  /** Assignments whose best solution a person has graded (DEC-163); null where unknown. */
  graded: ReadonlySet<string> | null;
}

export interface Standing {
  gained: number;
  total: number;
  hasLimit: boolean;
  passesLimit: boolean;
  /** Visible assignments the student has submitted to, out of `submittable`. */
  submitted: number;
  submittable: number;
  /** Visible assignments and shadow assignments a person has graded, out of `gradable`. Null
   *  where the reader could not read the solutions that decide it. */
  graded: number | null;
  gradable: number;
}

/**
 * core-api's `Assignment::isVisible`: published, and past its `visibleFrom` if it has one. The
 * exam-period condition the ACL adds on top is about *who* may open it during an exam, not whether
 * it counts, so it is left out.
 */
export function isStudentVisible(
  assignment: { isPublic: boolean; visibleFrom: number | null },
  nowSeconds: number,
): boolean {
  return (
    assignment.isPublic && (assignment.visibleFrom === null || assignment.visibleFrom <= nowSeconds)
  );
}

export function studentStanding(input: StandingInput): Standing {
  let gained = 0;
  let total = 0;
  let submitted = 0;
  let submittable = 0;
  let graded = 0;
  let gradable = 0;

  for (const row of input.stats.assignments) {
    const item = input.assignments.get(row.id);
    if (!item?.visible) continue;
    gained += (row.points.gained ?? 0) + (row.points.bonus ?? 0);
    if (!item.isBonus) total += item.maxPoints;
    submittable += 1;
    gradable += 1;
    const attempted = input.attempted ? input.attempted.has(row.id) : row.bestSolutionId !== null;
    if (attempted) submitted += 1;
    if (input.graded?.has(row.id)) graded += 1;
  }

  for (const row of input.stats.shadowAssignments) {
    const item = input.shadows.get(row.id);
    if (!item?.visible) continue;
    gained += row.points.gained ?? 0;
    if (!item.isBonus) total += item.maxPoints;
    gradable += 1;
    if (row.points.gained !== null) graded += 1;
  }

  let passesLimit: boolean | null = null;
  if (input.pointsLimit !== null && input.pointsLimit > 0) {
    passesLimit = gained >= input.pointsLimit;
  } else if (input.threshold !== null && input.threshold > 0) {
    passesLimit = gained >= total * input.threshold;
  }

  return {
    gained,
    total,
    hasLimit: passesLimit !== null,
    passesLimit: passesLimit ?? true,
    submitted,
    submittable,
    graded: input.graded ? graded : null,
    gradable,
  };
}
