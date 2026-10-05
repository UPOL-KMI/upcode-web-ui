import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getAssignmentDetail } from "@/lib/api/assignment";
import { getAssignmentSolutions } from "@/lib/api/assignment-solutions";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { ResubmitAll } from "@/components/assignments/resubmit-all";
import { SolutionsTable } from "@/components/assignments/solutions-table";
import { PageShell } from "@/components/page-shell";
import { Discussion } from "@/components/comments/discussion";
import { EmptyState } from "@/components/state/empty-state";
import { buttonClasses } from "@/components/button";
import { BackIcon, DownloadIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AssignmentSolutions" });
  return { title: t("title") };
}

/**
 * Every attempt at one assignment (T-003), for whoever set it.
 *
 * The companion to the class-progress table on the assignment screen (S-013): that one is a row
 * per student and answers "how is the group doing", this one is a row per submission and answers
 * "what did they actually send". Both are gated on the same hint,
 * `viewAssignmentSolutions` -- reached here by asking for the list and letting `apiRead` turn
 * core-api's 403 into the refusal page (F-030), because the assignment's own detail is fetched
 * anyway and the two answers cannot disagree.
 *
 * Everything is fetched at once and the table filters and sorts in the browser. That is the same
 * trade `getGroupList` makes and Q-015 records: core-api offers no server-side paging on this
 * endpoint, so the choice is between one request and none at all.
 */
export default async function AssignmentSolutionsPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const [{ assignmentId }, locale] = await Promise.all([params, getLocale()]);
  const [t, assignment, solutions] = await Promise.all([
    getTranslations("AssignmentSolutions"),
    getAssignmentDetail(assignmentId, locale),
    getAssignmentSolutions(assignmentId),
  ]);
  const breadcrumbs = await resolveBreadcrumbs(`/assignments/${assignmentId}/solutions`, locale);

  const authors = new Set(solutions.map((solution) => solution.authorId)).size;

  return (
    <PageShell
      title={t("title")}
      subtitle={assignment.name}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/assignments/${assignmentId}`} className={buttonClasses("outline", "sm")}>
            <BackIcon />
            {t("backToAssignment")}
          </Link>
          {solutions.length > 0 && (
            <a
              href={`/api/assignments/${assignmentId}/best-solutions`}
              className={buttonClasses("outline", "sm")}
            >
              <DownloadIcon />
              {t("downloadBest")}
            </a>
          )}
          {assignment.can.resubmitSubmissions === true && solutions.length > 0 && (
            <ResubmitAll assignmentId={assignmentId} />
          )}
        </div>
      }
    >
      {solutions.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {t("summary", { solutions: solutions.length, authors })}
          </p>
          <SolutionsTable solutions={solutions} scopeId={assignmentId} />
        </div>
      )}

      {/* The **assignment's** discussion, not one of its own: the legacy screen mounts the same
          thread here, and a teacher looking at every attempt is exactly who wants to read what was
          said about the assignment. */}
      <div className="mt-8">
        <Discussion
          threadId={assignmentId}
          subject="assignment"
          canModerate
          teacherIds={assignment.groupTeacherIds}
        />
      </div>
    </PageShell>
  );
}
