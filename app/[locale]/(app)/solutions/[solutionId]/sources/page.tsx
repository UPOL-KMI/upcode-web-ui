import { Suspense } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ApiError } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/api/current-user";
import { isBinaryFilename } from "@/lib/code/binary-files";
import {
  fileDisplayLimit,
  getFileContent,
  getSolutionFiles,
  MAX_DISPLAYED_FILES,
  type FileContent,
  type SolutionFileEntry,
} from "@/lib/api/solution-files";
import { getSolutionDetail } from "@/lib/api/solution";
import { getAssignmentSolutionsOf } from "@/lib/api/assignment";
import { getAssignmentSolutions } from "@/lib/api/assignment-solutions";
import { gradingEntries, gradingQueue, isGradedByPerson } from "@/lib/grading/queue";
import { attemptStanding } from "@/lib/grading/standing";
import {
  getSolutionReview,
  groupCommentsByFile,
  visibleReviewComments,
  type ReviewComment,
  type SolutionReview,
} from "@/lib/api/solution-review";
import { getCommentThread } from "@/lib/api/comments";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";
import { PageTabs, type PageTab } from "@/components/page-tabs";
import { Discussion } from "@/components/comments/discussion";
import { Markdown } from "@/components/markdown/markdown";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorBoundary } from "@/components/state/error-boundary";
import { TableSkeleton } from "@/components/state/skeleton";
import { ComparePicker } from "@/components/solutions/compare-picker";
import { ReviewControls } from "@/components/solutions/review-controls";
import { ReviewSummary } from "@/components/solutions/review-summary";
import { ToggleAllFiles } from "@/components/solutions/toggle-all-files";
import { GradingNav } from "@/components/solutions/grading-nav";
import { GradingStatus } from "@/components/solutions/grading-status";
import { AttemptsDialog } from "@/components/solutions/attempts-dialog";
import { SolutionList } from "@/components/assignments/solution-list";
import { GradingPoints } from "@/components/solutions/grading-points";
import { fileAnchorId, SourceFile } from "@/components/solutions/source-file";
import { buttonClasses } from "@/components/button";
import { BackIcon, DownloadIcon } from "@/components/icons";

const EMPTY_REVIEW: SolutionReview = { comments: [], startedAt: null, closedAt: null };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Sources" });
  return { title: t("title") };
}

/**
 * The solution's source code (S-017) and its review (S-018) -- `docs/IA.md` §4.4's right column,
 * given its own route (`/solutions/:id/sources`) exactly as §2 lays it out.
 *
 * A separate page rather than a second column on the solution screen, and that is the IA's own
 * split: the evaluation answers "what happened", the sources answer "what did I write, and what
 * did my teacher say about it". They are read at different moments, they are each long, and only
 * one of them is worth linking someone directly to a line of.
 *
 * **Who sees the comments is not who may fetch them.** core-api discloses a review to the
 * solution's author as soon as one exists; the legacy app shows the author nothing until the
 * review is closed, and `visibleReviewComments()` keeps that rule -- a half-written review is not
 * a verdict. What the *reviewer* may do comes from `permissionHints` and is re-checked by core-api
 * on every write.
 */
export default async function SolutionSourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ solutionId: string }>;
  searchParams: Promise<{ tab?: string; grade?: string }>;
}) {
  const [{ solutionId }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const [t, tGrading, status, solution, files, currentUser] = await Promise.all([
    getTranslations("Sources"),
    getTranslations("Grading"),
    getTranslations("Status"),
    getSolutionDetail(solutionId, locale),
    getSolutionFiles(solutionId),
    getCurrentUser(),
  ]);
  // The review cannot join the fetch above: whether it may be asked for at all is that fetch's own
  // answer, and asking without the hint is a refusal rather than an empty review.
  const [breadcrumbs, review] = await Promise.all([
    resolveBreadcrumbs(`/solutions/${solutionId}/sources`, locale),
    solution.can.viewReview ? getSolutionReview(solutionId) : EMPTY_REVIEW,
  ]);

  const canReview = solution.can.review === true;
  // A comment can only be added to a review that has been opened -- the legacy rule, and the one
  // that keeps "start a review" a deliberate act rather than a side effect of typing.
  const canComment = solution.can.addReviewComment === true && review.startedAt !== null;
  const comments = visibleReviewComments(review, canReview);
  const grouped = groupCommentsByFile(
    comments,
    files.map((file) => file.name),
  );
  const canModerate = solution.groupPrimaryAdminIds.includes(currentUser.id);

  // Grading mode (X-031): `?grade=1`, for whoever may read the class's other solutions -- the
  // queue is made of them, and the attempts dialog of this student's.
  const grading = query.grade === "1" && solution.canViewSolutions;
  const showPoints = solution.can.setBonusPoints === true || canReview;
  // The student's attempts also say, outside grading mode, whether the open one counts.
  const [classSolutions, attempts] = await Promise.all([
    grading ? getAssignmentSolutions(solution.assignmentId) : [],
    showPoints && solution.canViewSolutions
      ? getAssignmentSolutionsOf(solution.assignmentId, solution.authorId)
      : [],
  ]);
  const { standing, latest } = attemptStanding(
    solutionId,
    attempts.map((attempt) => ({
      ...attempt,
      failed:
        !attempt.evaluation.lastSubmission || attempt.evaluation.lastSubmission.failure === true,
    })),
  );
  const queue = grading ? gradingQueue(gradingEntries(classSolutions), solution.authorId) : null;
  const studentName =
    classSolutions.find((row) => row.authorId === solution.authorId)?.authorName ?? "";
  const tableHref = `/assignments/${solution.assignmentId}?tab=solutions`;

  // A review comment is authored markdown and is rendered as such (G-027). It has to happen here,
  // on the server: `Markdown` is an async Server Component and every component between this page
  // and the comment is a client island, because a comment thread appears *between* two lines of
  // code. One render per comment, handed down by id.
  const bodies = Object.fromEntries(
    comments.map((comment) => [comment.id, <Markdown key={comment.id} source={comment.text} />]),
  );

  const displayLimit = fileDisplayLimit(files);

  /**
   * Two tabs (X-026): the files with their review, and the discussion.
   *
   * **The discussion is the solution's own thread**, the very one its detail screen shows -- this
   * is a second place to reach one conversation, not a second conversation. An unknown `?tab=`
   * falls back to the review rather than rendering nothing.
   */
  // Read here for the number on its tab; `getCommentThread` is `cache`d, so the `Discussion`
  // below reuses this answer rather than asking for the thread a second time.
  const thread = await getCommentThread(solutionId);
  const tabs: PageTab[] = [
    { id: "review", label: t("tabs.review") },
    { id: "discussion", label: t("tabs.discussion"), count: thread?.comments.length ?? 0 },
  ];
  const currentTab = tabs.some((tab) => tab.id === query.tab) ? query.tab! : "review";

  return (
    <PageShell
      title={t("title")}
      subtitle={`${solution.assignmentName} — ${t("attempt", { attempt: solution.attemptIndex })}`}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ReviewControls
            solutionId={solutionId}
            startedAt={review.startedAt}
            closedAt={review.closedAt}
            canReview={canReview}
            canDeleteReview={solution.can.deleteReview === true}
            hideMarkReviewed={showPoints}
          />
          <a
            href={`/api/solutions/${solutionId}/download`}
            className={buttonClasses("outline", "sm")}
          >
            <DownloadIcon />
            {t("download")}
          </a>
          <Link href={`/solutions/${solutionId}`} className={buttonClasses("outline", "sm")}>
            <BackIcon />
            {t("backToSolution")}
          </Link>
        </div>
      }
      tabs={
        <>
          {/* Above the tabs, because both tabs are about whoever is chosen here. */}
          {queue && (
            <div className="mb-4">
              <GradingNav
                queue={queue}
                studentName={studentName}
                tableHref={tableHref}
                attempts={
                  <AttemptsDialog
                    label={tGrading("attempt", {
                      attempt: solution.attemptIndex,
                      count: attempts.length,
                    })}
                    title={tGrading("attemptsTitle", { name: studentName })}
                  >
                    <SolutionList solutions={attempts} grading />
                  </AttemptsDialog>
                }
              />
            </div>
          )}
          <PageTabs
            basePath={`/solutions/${solutionId}/sources`}
            tabs={tabs}
            current={currentTab}
            label={t("tabs.label")}
            keepQuery={grading ? "grade=1" : undefined}
          />
        </>
      }
    >
      {showPoints && (
        // Sticky while grading, so the points stay in reach down a long file; matte, so it reads as
        // a layer over the code rather than as part of it.
        <div
          className={
            grading
              ? "sticky top-0 z-20 mb-6 flex flex-col gap-2 rounded-lg border border-border bg-muted/85 p-3 shadow-sm backdrop-blur"
              : "mb-6 flex flex-col gap-2 rounded-lg border border-border p-4"
          }
        >
          <GradingStatus
            solutionId={solutionId}
            graded={isGradedByPerson({
              overridden: solution.overridden,
              bonus: solution.bonus,
              reviewClosedAt: review.closedAt,
            })}
            standing={standing}
            latest={latest}
            canAccept={solution.can.setFlag === true}
            grading={grading}
          />
          {/* Not on an attempt that never counts: points and acceptance there would change nothing. */}
          {standing?.kind !== "failed" && (
            <GradingPoints
              key={solutionId}
              solutionId={solutionId}
              maxPoints={solution.maxPoints}
              evaluatedPoints={solution.evaluation?.points ?? null}
              overridden={solution.overridden}
              bonus={solution.bonus}
              reviewStartedAt={review.startedAt}
              reviewClosedAt={review.closedAt}
              canSetPoints={solution.can.setBonusPoints === true}
              canReview={canReview}
            />
          )}
        </div>
      )}
      <div className="flex flex-col gap-8">
        {currentTab === "review" && (
          <>
            {/* An open review is a warning, not a note. It says the author cannot see any of this yet
            and that closing it sends mail -- the two facts a reviewer most needs in mind -- and in
            grey on grey the operator could not see it at all. The surfaces are the opaque `-surface`
            tokens rather than a `/10` tint, here and on its two neighbours, so a box reads the same
            over the page and over a card. */}
            {canReview && review.startedAt !== null && review.closedAt === null && (
              <p className="rounded-lg border border-warning bg-warning-surface p-4 text-sm">
                {t("reviewOpenNote")}
              </p>
            )}
            {canReview && review.closedAt !== null && (
              <p className="rounded-lg border border-success bg-success-surface p-4 text-sm">
                {t("reviewClosedNote")}
              </p>
            )}
            {!canReview && solution.authorId === currentUser.id && review.closedAt !== null && (
              <p
                className={`rounded-lg border p-4 text-sm ${
                  solution.reviewIssues > 0
                    ? "border-warning bg-warning-surface"
                    : "border-success bg-success-surface"
                }`}
              >
                {solution.reviewIssues > 0
                  ? t("reviewedWithIssues", { issues: solution.reviewIssues })
                  : t("reviewedNoIssues")}
              </p>
            )}

            <ReviewSummary
              solutionId={solutionId}
              comments={grouped.get("") ?? []}
              bodies={bodies}
              canComment={canComment}
              canModerate={canModerate}
              currentUserId={currentUser.id}
              reviewClosed={review.closedAt !== null}
            />

            {files.length === 0 ? (
              <EmptyState title={t("empty.title")} description={t("empty.description")} />
            ) : displayLimit !== null ? (
              <EmptyState
                title={t("tooMany.title")}
                description={
                  displayLimit === "count"
                    ? t("tooMany.byCount", { count: files.length, max: MAX_DISPLAYED_FILES })
                    : t("tooMany.bySize")
                }
              />
            ) : (
              <>
                {/* The index and the fold controls share a row: both are about getting around the
                files below, and the controls belong at the top right of what they act on. The
                index keeps the left even with one file, where it is absent. */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  {files.length > 1 ? (
                    <nav aria-label={t("fileListLabel")} className="flex flex-wrap gap-2">
                      {files.map((file) => (
                        <a
                          key={file.name}
                          href={`#${fileAnchorId(file.name)}`}
                          className="rounded-md border border-input px-2 py-1 font-mono text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {file.name}
                        </a>
                      ))}
                    </nav>
                  ) : (
                    <span />
                  )}
                  <ToggleAllFiles />
                </div>
                <ErrorBoundary>
                  <Suspense fallback={<TableSkeleton label={status("loading")} />}>
                    <SourceFileList
                      solutionId={solutionId}
                      files={files}
                      comments={grouped}
                      bodies={bodies}
                      canComment={canComment}
                      canModerate={canModerate}
                      currentUserId={currentUser.id}
                      reviewClosed={review.closedAt !== null}
                    />
                  </Suspense>
                </ErrorBoundary>
              </>
            )}

            {/* Comparing is a teacher's tool: the list it offers is *other* attempts, which is exactly
            what `viewAssignmentSolutions` grants and what the solution's own `viewDetail` does not
            -- an author has that for their own work and must not be shown a picker whose reader
            would be refused. */}
            {solution.canViewSolutions && (
              <ComparePicker
                solutionId={solutionId}
                assignmentId={solution.assignmentId}
                authorId={solution.authorId}
              />
            )}
          </>
        )}

        {/* The **solution's** thread, the same one its own screen shows -- the legacy app mounts
            it in both places, and the sources are where a remark about the code belongs. Not the
            same thing as S-018's inline review comments, which are attached to a line. */}
        {currentTab === "discussion" && (
          <ErrorBoundary>
            <Suspense fallback={<TableSkeleton label={status("loading")} />}>
              <Discussion
                threadId={solutionId}
                subject="solution"
                canModerate={solution.can.review === true}
                teacherIds={solution.groupTeacherIds}
              />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </PageShell>
  );
}

/**
 * The submitted files themselves: one content read per file, then one server-side highlighting
 * pass per file. Both belong below a boundary rather than in the page -- everything above them
 * (the review, its notices, the file index) is ready long before as much as a megabyte of source
 * has been fetched and tokenised, and only this section has to wait for it.
 *
 * Which files these are, and whether they may be shown at all, is settled by the page above:
 * `canDisplayFiles` and the comment grouping stay there and arrive as props.
 */
async function SourceFileList({
  solutionId,
  files,
  comments,
  bodies,
  canComment,
  canModerate,
  currentUserId,
  reviewClosed,
}: {
  solutionId: string;
  files: SolutionFileEntry[];
  comments: Map<string, ReviewComment[]>;
  bodies: Record<string, React.ReactNode>;
  canComment: boolean;
  canModerate: boolean;
  currentUserId: string;
  reviewClosed: boolean;
}) {
  const contents = await Promise.all(
    files.map(async (file): Promise<{ content: FileContent | null; error?: string }> => {
      // A PDF is not fetched at all: `SourceFile` will offer it rather than render it, and pulling
      // forty megabytes across to discover that is the cost this classification exists to avoid.
      if (isBinaryFilename(file.entry ?? file.name)) return { content: null };
      try {
        return { content: await getFileContent(file.fileId, file.entry) };
      } catch (error) {
        // One unreadable file must not cost the reader the other thirty-one.
        return { content: null, error: error instanceof ApiError ? error.message : undefined };
      }
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      {files.map((file, index) => (
        <SourceFile
          key={file.name}
          solutionId={solutionId}
          file={file}
          content={contents[index]?.content ?? null}
          contentError={contents[index]?.error}
          // Only a whole submitted file can be downloaded on its own; an entry inside an archive
          // has no bytes of its own to serve, and says so instead.
          downloadHref={
            file.entry === null
              ? `/api/solutions/${solutionId}/files/${encodeURIComponent(file.fileId)}`
              : null
          }
          review={{
            comments: comments.get(file.name) ?? [],
            bodies,
            canComment,
            canModerate,
            currentUserId,
            reviewClosed,
          }}
        />
      ))}
    </div>
  );
}
