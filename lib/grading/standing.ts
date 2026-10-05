/**
 * Whether the attempt open in grading counts towards the student's result (X-031).
 *
 * core-api counts one solution per student and assignment, its "best": the accepted one if any,
 * otherwise the one with the most points in total (a teacher's points in place of the evaluation's,
 * plus the bonus), the newest on a tie. Points given to any other attempt change nothing, so the
 * bar says so before a teacher grades work that will not count. `isBest` is core-api's own answer,
 * not this rule recomputed here.
 *
 * **An attempt whose evaluation failed never counts**, not even accepted or given points: core-api
 * leaves it out before choosing (`AssignmentSolutions::filterValidSolutions`). It still lets the
 * flag be set and points be given, so the bar is the only place that says they do nothing.
 */
export interface AttemptForStanding {
  id: string;
  attemptIndex: number;
  createdAt: number;
  /** The teacher's points where set, else the evaluation's -- core-api's `actualPoints`. */
  gained: number | null;
  bonus: number;
  accepted: boolean;
  isBest: boolean;
  /** No submission, or one whose evaluation failed -- what core-api excludes. */
  failed: boolean;
}

export type Standing =
  | { kind: "failed"; counted: AttemptForStanding | null }
  | { kind: "accepted" }
  | { kind: "best" }
  | { kind: "elsewhere"; counted: AttemptForStanding };

export function attemptStanding(
  currentId: string,
  attempts: readonly AttemptForStanding[],
): { standing: Standing | null; latest: AttemptForStanding | null } {
  const current = attempts.find((attempt) => attempt.id === currentId);
  if (!current) return { standing: null, latest: null };

  const newest = attempts.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
  const latest = newest.id === current.id ? null : newest;

  const counted = attempts.find((attempt) => attempt.isBest) ?? null;
  if (current.failed && !current.isBest) return { standing: { kind: "failed", counted }, latest };
  if (current.isBest) return { standing: { kind: current.accepted ? "accepted" : "best" }, latest };
  return { standing: counted ? { kind: "elsewhere", counted } : null, latest };
}
