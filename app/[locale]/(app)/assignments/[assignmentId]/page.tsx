import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getAssignmentDetail } from "@/lib/api/assignment";
import { getCommentThread } from "@/lib/api/comments";
import { getAssignmentSolverSummary } from "@/lib/api/assignment-solvers";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { AssignmentDetailView } from "@/components/assignments/assignment-detail";
import { ClassProgress } from "@/components/assignments/class-progress";
import { ExerciseSyncNotice } from "@/components/assignments/exercise-sync-notice";
import { PageShell } from "@/components/page-shell";
import { PageTabs, type PageTab } from "@/components/page-tabs";
import { Discussion } from "@/components/comments/discussion";
import { ErrorBoundary } from "@/components/state/error-boundary";
import { TableSkeleton } from "@/components/state/skeleton";
import { Badge } from "@/components/status/badge";
import { VisibilityBadge } from "@/components/status/visibility-badge";
import { buttonClasses } from "@/components/button";
import { BackIcon, PencilIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Assignment" });
  return { title: t("title") };
}

/**
 * An assignment (S-012) -- the destination every deadline row on the dashboard and in a group has
 * been linking to since S-001 -- and, for whoever set it, how the group is doing on it (S-013).
 *
 * The two audiences share one page, as `docs/IA.md` §4.3 lays it out ("same as student, plus"),
 * and each addition is gated on core-api's own hint rather than on a role: `viewAssignmentSolutions`
 * for the class progress, `update` for the terms only its author needs. Of the **links** §4.3 also
 * lists are both here now: "all submissions" (T-003) on the same hint the class progress uses, and
 * "edit assignment" (T-002) on `update`.
 */
export default async function AssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ assignmentId }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const [t, status, assignment, thread] = await Promise.all([
    getTranslations("Assignment"),
    getTranslations("Status"),
    getAssignmentDetail(assignmentId, locale),
    // **Only for the number on the tab.** The discussion itself still streams behind its own
    // boundary; this call is memoized per request, so the two are one fetch and the shell waits
    // for it in parallel with the assignment rather than after it. A tab that says how much is
    // behind it has to know before it is drawn.
    getCommentThread(assignmentId),
  ]);
  const breadcrumbs = await resolveBreadcrumbs(`/assignments/${assignmentId}`, locale);

  const tabs: PageTab[] = [
    { id: "text", label: t("tabs.text") },
    { id: "solutions", label: t("tabs.solutions"), count: assignment.mySolutions.length },
    { id: "discussion", label: t("tabs.discussion"), count: thread?.comments.length },
  ];
  const current = tabs.some((tab) => tab.id === query.tab) ? query.tab! : "text";

  return (
    <PageShell
      title={assignment.name}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {assignment.isBonus && <Badge tone="info">{t("badges.bonus")}</Badge>}
          {assignment.isExam && <Badge tone="warning">{t("badges.exam")}</Badge>}
          {/* Hidden, or published for a moment that has not come yet -- the header said nothing
              about the second, so a scheduled assignment looked like an ordinary live one. */}
          <VisibilityBadge
            isPublic={assignment.isPublic}
            visibleFrom={assignment.visibleFrom}
            hideWhenVisible
          />
          {/* The way back comes first: it is where this page was reached from. */}
          {assignment.groupId && (
            <Link
              href={`/groups/${assignment.groupId}?tab=assignments`}
              className={buttonClasses("outline", "sm")}
            >
              <BackIcon />
              {t("backToGroup")}
            </Link>
          )}
          {assignment.can.update && (
            <Link
              href={`/assignments/${assignmentId}/edit`}
              className={buttonClasses("warning-outline", "sm")}
            >
              <PencilIcon />
              {t("editAssignment")}
            </Link>
          )}
          {assignment.can.viewAssignmentSolutions && (
            <Link
              href={`/assignments/${assignmentId}/solutions`}
              className={buttonClasses("outline", "sm")}
            >
              {t("allSolutions")}
            </Link>
          )}
        </div>
      }
      subtitle={assignment.groupName || undefined}
      tabs={
        <PageTabs
          basePath={`/assignments/${assignmentId}`}
          tabs={tabs}
          current={current}
          label={t("tabs.label")}
        />
      }
    >
      <div className="flex flex-col gap-8">
        {/* The notice is about the text, so it lives with it. */}
        {current === "text" && <ExerciseSyncNotice assignment={assignment} />}
        {current !== "discussion" && (
          <AssignmentDetailView
            assignment={assignment}
            tab={current === "solutions" ? "solutions" : "text"}
          />
        )}
        {/* The hint decides *whether* this section exists, above the boundary; only its fetch
            streams. Moving the gate below it would mean claiming the reader may see this before
            knowing that they may. */}
        {current === "solutions" &&
          assignment.can.viewAssignmentSolutions &&
          assignment.groupId && (
            <ErrorBoundary>
              <Suspense fallback={<TableSkeleton label={status("loading")} />}>
                <ClassProgressSection
                  assignmentId={assignmentId}
                  groupId={assignment.groupId}
                  maxPoints={assignment.maxPointsFirst}
                  dataOnly={assignment.dataOnly}
                />
              </Suspense>
            </ErrorBoundary>
          )}

        {current === "discussion" && (
          <ErrorBoundary>
            <Suspense fallback={<TableSkeleton label={status("loading")} />}>
              <Discussion
                threadId={assignmentId}
                subject="assignment"
                canModerate={assignment.can.update === true}
                teacherIds={assignment.groupTeacherIds}
              />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </PageShell>
  );
}

/**
 * The class progress (S-013), reading its own summary so that the whole-group roster behind it
 * holds back only this section rather than every byte of the page.
 */
async function ClassProgressSection({
  assignmentId,
  groupId,
  maxPoints,
  dataOnly,
}: {
  assignmentId: string;
  groupId: string;
  maxPoints: number;
  dataOnly: boolean;
}) {
  const { solvers, summary } = await getAssignmentSolverSummary(
    assignmentId,
    groupId,
    maxPoints,
    dataOnly,
  );

  return <ClassProgress assignmentId={assignmentId} solvers={solvers} summary={summary} />;
}
