import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getGroupDetail } from "@/lib/api/group-detail";
import { getGroupUserSolutions } from "@/lib/api/group-user-solutions";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { SolutionsTable } from "@/components/assignments/solutions-table";
import { ClosePendingReviews } from "@/components/groups/close-pending-reviews";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";
import { buttonClasses } from "@/components/button";
import { BackIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "GroupUserSolutions" });
  return { title: t("title") };
}

/**
 * One student's whole course, submission by submission (T-005) -- the legacy
 * `/app/group/:groupId/user/:userId` route.
 *
 * The screen a teacher reaches from a name on the roster when the question stops being about the
 * work and starts being about the person: everything this student has handed in here, across every
 * assignment, newest first. A student may open their **own** and nobody else's -- core-api's
 * `canViewStudentStats` is written that way and answers 403 for the rest, which is what makes this
 * useful to both audiences without a second screen.
 *
 * The legacy page offers a "group by assignments" toggle that stacks a table per assignment. This
 * is one table with an **Assignment** column instead (DEC-094): sorting by it groups the rows the
 * same way, the sort lives in the URL rather than in `localStorage`, and the filter box narrows to
 * one assignment by name -- which the legacy boxes cannot do at all. "Best solutions only" stays a
 * real filter, because no sort expresses it.
 */
export default async function GroupUserSolutionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string; userId: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const [{ groupId, userId }, query, locale] = await Promise.all([
    params,
    searchParams,
    getLocale(),
  ]);
  const [t, group] = await Promise.all([
    getTranslations("GroupUserSolutions"),
    getGroupDetail(groupId, locale),
  ]);

  // The same pair core-api checks (`GroupsPresenter::checkStudentsSolutions`), asked here first so
  // a reader who may not see this group's work is refused rather than shown an empty page. The
  // second half of it -- may this reader ask about *this* student -- has no hint to read and is
  // core-api's to answer, which it does on the fetch below.
  if (group.can.viewAssignments !== true) forbidden();
  // `studentIds` is empty only where the reader may not see the roster; where it is known, a
  // person who does not study here is an address that names nothing.
  if (group.studentIds.length > 0 && !group.studentIds.includes(userId)) notFound();

  const [data, breadcrumbs] = await Promise.all([
    getGroupUserSolutions(groupId, userId, locale),
    resolveBreadcrumbs(`/groups/${groupId}/users/${userId}`, locale),
  ]);

  const bestOnly = query.filter === "best";
  const rows = bestOnly ? data.rows.filter((row) => row.isBest) : data.rows;

  return (
    <PageShell
      title={data.student.fullName || userId}
      subtitle={group.name}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/users/${userId}`} className={buttonClasses("outline", "sm")}>
            {t("viewProfile")}
          </Link>
          <Link href={`/groups/${groupId}?tab=students`} className={buttonClasses("outline", "sm")}>
            <BackIcon />
            {t("backToGroup")}
          </Link>
        </div>
      }
    >
      {data.rows.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description", { name: data.student.fullName })}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t("summary", {
              solutions: data.rows.length,
              assignments: data.assignmentsAttempted,
            })}
          </p>

          {data.similarities > 0 && (
            <p className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
              {t("similarities", { count: data.similarities })}
            </p>
          )}

          {data.pendingReviews.length > 0 && !group.archived && (
            <ClosePendingReviews solutionIds={data.pendingReviews} />
          )}

          <div className="flex flex-wrap gap-2">
            {(["all", "best"] as const).map((option) => {
              const active = option === (bestOnly ? "best" : "all");
              return (
                <Link
                  key={option}
                  href={
                    option === "all"
                      ? `/groups/${groupId}/users/${userId}`
                      : `/groups/${groupId}/users/${userId}?filter=best`
                  }
                  aria-current={active ? "true" : undefined}
                  className={`rounded-full px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(`filters.${option}`)}
                </Link>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <EmptyState title={t("noBest.title")} description={t("noBest.description")} />
          ) : (
            <SolutionsTable solutions={rows} scopeId={userId} lead="assignment" />
          )}
        </div>
      )}
    </PageShell>
  );
}
