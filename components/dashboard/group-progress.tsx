import { getFormatter, getTranslations } from "next-intl/server";

import { formatPoints } from "@/lib/format/points";
import type { GroupProgress } from "@/lib/api/dashboard";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/status/badge";

/**
 * "How am I doing?" (`docs/IA.md` §4.1) -- points earned against points available, per group,
 * plus the pass threshold where the group sets one.
 *
 * The threshold is rendered from `limit`/`hasLimit`/`passesLimit` exactly as core-api computes
 * them, never re-derived here: a group may express it as a percentage or as an absolute number of
 * points, and core-api has already resolved both into the same absolute figure (see
 * `GroupStudentStats`). Recomputing it in the UI is how the app and the grade sheet end up
 * disagreeing about who passed.
 *
 * Both totals already include shadow (bonus) assignments; their individual rows belong to S-025.
 */
function percentOf(gained: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (gained / total) * 100));
}

export async function GroupProgressCards({ groups }: { groups: GroupProgress[] }) {
  const [t, format] = await Promise.all([getTranslations("Dashboard.progress"), getFormatter()]);

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {groups.map((group) => {
        const percent = percentOf(group.gained, group.total);
        // A group that has assigned nothing yet has no progress to report, and "0/0 points" under
        // an empty bar reads as a failure rather than as an absence.
        const nothingAssigned = group.gradable === 0 && group.total === 0;
        return (
          <li key={group.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <h4 className="font-medium">
                <Link
                  href={`/groups/${group.id}`}
                  className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {group.name}
                </Link>
              </h4>
              {group.hasLimit && (
                <Badge tone={group.passesLimit ? "success" : "warning"}>
                  {group.passesLimit ? t("limitMet") : t("limitNotMet")}
                </Badge>
              )}
            </div>

            {nothingAssigned ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("nothingAssigned")}</p>
            ) : (
              <>
                <p className="mt-3 text-2xl font-semibold tabular-nums">
                  {formatPoints(group.gained, group.total)}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {t("points")}
                  </span>
                </p>

                <div
                  role="progressbar"
                  aria-valuenow={group.gained}
                  aria-valuemin={0}
                  aria-valuemax={group.total}
                  aria-label={t("barLabel", { group: group.name })}
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <p className="mt-3 text-sm text-muted-foreground">
                  {[
                    group.submittable > 0 &&
                      (group.submitted >= group.submittable
                        ? t("allSubmitted")
                        : t("toSubmit", { count: group.submittable - group.submitted })),
                    group.graded !== null &&
                      t("graded", { graded: group.graded, total: group.gradable }),
                    group.hasLimit &&
                      group.limit !== null &&
                      t("limit", {
                        limit: format.number(group.limit, { maximumFractionDigits: 1 }),
                      }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
