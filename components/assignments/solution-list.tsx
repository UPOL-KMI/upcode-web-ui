import { getTranslations } from "next-intl/server";

import type { AssignmentSolutionRow } from "@/lib/api/assignment";
import { formatPoints, formatPointsUnknown } from "@/lib/format/points";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { RelativeTime } from "@/components/format/relative-time";
import { Badge } from "@/components/status/badge";
import { evaluationStatus } from "@/lib/status/evaluation";

import { EvaluationBadge } from "@/components/status/evaluation-badge";
import { BonusPoints } from "@/components/format/bonus-points";

/**
 * One person's attempts at one assignment, newest first.
 *
 * Shared by the assignment screen's "my solutions" (S-012) and by the same table read about
 * someone else (S-013) -- the columns are identical because the question is, and a teacher
 * comparing their own view against a student's should not be reading two different tables.
 *
 * The similarities flag (S-019) is the one row that reads differently for the two audiences, and
 * not by this component's doing: core-api discloses a solution's detection batch only to a reader
 * holding `viewDetectedPlagiarisms`, so the badge simply is not there for the solution's author.
 */
export async function SolutionList({
  solutions,
  grading = false,
}: {
  solutions: AssignmentSolutionRow[];
  /** Each attempt opens in grading mode (X-031), from the grading bar's attempts dialog. */
  grading?: boolean;
}) {
  const [t, tStatus] = await Promise.all([
    getTranslations("Assignment"),
    getTranslations("Status.evaluation"),
  ]);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">{t("columns.attempt")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("columns.submitted")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("columns.points")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("columns.status")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("columns.flags")}</th>
          </tr>
        </thead>
        <tbody>
          {solutions.map((solution) => (
            <tr
              key={solution.id}
              className="border-b border-border last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2">
                <Link
                  href={
                    grading
                      ? `/solutions/${solution.id}/sources?grade=1`
                      : `/solutions/${solution.id}`
                  }
                  className="font-medium whitespace-nowrap hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {t("attemptNumber", { index: solution.attemptIndex })}
                </Link>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <DateTime unixSeconds={solution.createdAt} withSeconds />
                  <span className="text-muted-foreground">
                    <RelativeTime unixSeconds={solution.createdAt} />
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                {/* Same rule as everywhere else: until somebody has marked it, the points are a
                    question rather than a number. */}
                {evaluationStatus(solution.evaluation) === "awaiting-review" ? (
                  <span className="text-muted-foreground">
                    {formatPointsUnknown(solution.maxPoints)}
                  </span>
                ) : (
                  formatPoints(solution.gained ?? 0, solution.maxPoints)
                )}
                <BonusPoints bonus={solution.bonus} />
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <EvaluationBadge solution={solution.evaluation} />
                  {/* The verdict comes from the exercise's scoring; this is what the tests did.
                      They part company as soon as a test carries no weight -- see `testTallyOf`. */}
                  {solution.tests && (
                    <span className="text-xs whitespace-nowrap text-muted-foreground">
                      {tStatus("testsPassed", {
                        passed: solution.tests.passed,
                        total: solution.tests.total,
                      })}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {solution.isBest && <Badge tone="success">{t("flags.best")}</Badge>}
                  {solution.accepted && <Badge tone="info">{t("flags.accepted")}</Badge>}
                  {solution.reviewRequested && !solution.reviewClosed && (
                    <Badge tone="warning">{t("flags.reviewRequested")}</Badge>
                  )}
                  {solution.reviewClosed && <Badge>{t("flags.reviewed")}</Badge>}
                  {solution.plagiarismBatchId !== null && (
                    <Link
                      href={`/solutions/${solution.id}/plagiarisms`}
                      className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <Badge tone="warning">{t("flags.similarities")}</Badge>
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
