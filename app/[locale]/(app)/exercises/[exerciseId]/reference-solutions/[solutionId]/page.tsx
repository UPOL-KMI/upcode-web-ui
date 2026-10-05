import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { ApiError } from "@/lib/api/client";
import { getExerciseDetail } from "@/lib/api/exercise-detail";
import { getReferenceSolution } from "@/lib/api/reference-solutions";
import { isBinaryFilename } from "@/lib/code/binary-files";
import { canDisplayFiles, getFileContent, type FileContent } from "@/lib/api/solution-files";
import { formatBytes } from "@/lib/format/bytes";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
import { EVALUATION_TONE, evaluationStatus } from "@/lib/status/evaluation";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { EvaluationResults } from "@/components/solutions/evaluation-results";
import {
  DeleteReferenceSubmission,
  ReferenceRunControls,
} from "@/components/exercises/reference-run-controls";
import { SourceFile } from "@/components/solutions/source-file";
import { PageShell } from "@/components/page-shell";
import { Discussion } from "@/components/comments/discussion";
import { Badge } from "@/components/status/badge";
import { buttonClasses } from "@/components/button";
import { BackIcon, DownloadIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ReferenceSolutions.detail" });
  return { title: t("pageTitle") };
}

/**
 * One reference solution and what the pipeline made of it (T-011).
 *
 * The evaluation half is S-015's component unchanged -- widened by this ticket to take the two
 * fields it actually reads rather than a whole assignment solution, since a reference solution has
 * none of the rest of one (no attempt index, no points, no review). That is the whole claim this
 * screen makes: a reference run is the exercise's own configuration executed for real, so it is
 * read exactly as a student's would be.
 *
 * **Every submission is listed, not only the last.** A reference solution is re-evaluated whenever
 * the configuration changes, and the history is the record of what the exercise used to do to the
 * same code -- which is the evidence an author wants when a change broke something.
 *
 * **The files are read here, not behind a second screen (G-013).** The answer is the point of a
 * reference solution -- an exercise cannot be assigned without one (DEC-097) -- and until this
 * ticket the author of an exercise could not read the solution that proves it works: the list was
 * a name and a size in a `<span>`, and this comment claimed the opposite. They render through
 * S-017's own `SourceFile`, under S-017's own ceiling (`canDisplayFiles`), and past it the archive
 * is what is offered instead. A student's solution gets a `/sources` route of its own because it
 * carries a review; this one has none, so a route would be a click for nothing.
 */
export default async function ReferenceSolutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ exerciseId: string; solutionId: string }>;
  searchParams: Promise<{ submission?: string }>;
}) {
  const [{ exerciseId, solutionId }, query, locale] = await Promise.all([
    params,
    searchParams,
    getLocale(),
  ]);
  const [t, solution] = await Promise.all([
    getTranslations("ReferenceSolutions.detail"),
    getReferenceSolution(solutionId),
  ]);

  // A reference solution's id says nothing about which exercise it belongs to, so a mismatched
  // pair is a wrong address rather than a refusal -- the same reading S-015 gives one.
  if (solution.exerciseId !== exerciseId) notFound();

  const [exercise, breadcrumbs] = await Promise.all([
    getExerciseDetail(exerciseId, locale),
    resolveBreadcrumbs(`/exercises/${exerciseId}/reference-solutions/${solutionId}`, locale),
  ]);

  const files = solution.files;

  // S-017's ceiling, for S-017's reason: past 32 files or a megabyte, highlighting them all costs
  // far more than the reader is asking for, and the archive is the honest answer.
  const readable = files.length > 0 && canDisplayFiles(files);
  const contents = readable
    ? await Promise.all(
        files.map(async (file): Promise<{ content: FileContent | null; error?: string }> => {
          // Same skip as S-017's: a file this app will not render as text is not fetched.
          if (isBinaryFilename(file.entry ?? file.name)) return { content: null };
          try {
            return { content: await getFileContent(file.fileId, file.entry) };
          } catch (error) {
            // One unreadable file must not cost the reader the others.
            return { content: null, error: error instanceof ApiError ? error.message : undefined };
          }
        }),
      )
    : [];

  // Which run is on screen. The newest by default -- it is the one that says whether the exercise
  // works *now* -- and any other by `?submission=`, so a particular run can be linked to and comes
  // back on a reload. An id that is not this solution's is a wrong address rather than a silent
  // fallback: the alternative shows one run under another's URL (DEC-090's shape).
  const selected =
    query.submission === undefined
      ? solution.lastSubmission
      : (solution.submissions.find((entry) => entry.id === query.submission) ?? null);
  if (query.submission !== undefined && selected === null) notFound();

  const isCurrentRun = selected === null || selected.id === solution.lastSubmission?.id;
  const solutionPath = `/exercises/${exerciseId}/reference-solutions/${solutionId}`;
  // core-api refuses to delete the last run (`checkDeleteSubmission`), so the control is offered
  // only where there is a second one to fall back to.
  const canDeleteRuns = solution.can.deleteEvaluation === true && solution.submissions.length > 1;

  const status = evaluationStatus({ lastSubmission: solution.lastSubmission, maxPoints: 1 });

  return (
    <PageShell
      title={solution.description || t("untitled")}
      subtitle={exercise.name}
      breadcrumbs={breadcrumbs}
      actions={
        <Link
          href={`/exercises/${exerciseId}/reference-solutions`}
          className={buttonClasses("outline", "sm")}
        >
          <BackIcon />
          {t("backToList")}
        </Link>
      }
    >
      <div className="flex flex-col gap-8">
        <section aria-labelledby="reference-solution-facts" className="flex flex-col gap-2">
          <h2 id="reference-solution-facts" className="sr-only">
            {t("facts")}
          </h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">{t("result")}</dt>
            <dd>
              <Badge tone={EVALUATION_TONE[status]}>{t(`status.${status}`)}</Badge>
            </dd>
            <dt className="text-muted-foreground">{t("language")}</dt>
            <dd>{solution.environmentName}</dd>
            <dt className="text-muted-foreground">{t("author")}</dt>
            <dd>{solution.authorName || "—"}</dd>
            <dt className="text-muted-foreground">{t("created")}</dt>
            <dd>
              <DateTime unixSeconds={solution.createdAt} />
            </dd>
          </dl>
        </section>

        <section aria-labelledby="reference-solution-files" className="flex flex-col gap-2">
          <h2 id="reference-solution-files" className="text-base font-semibold tracking-tight">
            {t("files")}
          </h2>
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noFiles")}</p>
          ) : (
            <>
              <div>
                <a
                  href={`/api/reference-solutions/${solutionId}/download`}
                  className={buttonClasses("outline", "sm")}
                >
                  <DownloadIcon />
                  {t("downloadArchive")}
                </a>
              </div>
              {readable ? (
                <div className="flex flex-col gap-4">
                  {files.map((file, index) => (
                    <SourceFile
                      key={file.name}
                      solutionId={solutionId}
                      file={file}
                      content={contents[index]?.content ?? null}
                      contentError={contents[index]?.error}
                    />
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{t("tooManyFiles")}</p>
                  <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
                    {files.map((file) => (
                      <li
                        key={file.name}
                        className="flex items-center justify-between gap-3 px-3 py-2"
                      >
                        <span className="truncate font-mono">{file.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatBytes(file.size)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="reference-solution-evaluation" className="flex flex-col gap-2">
          <h2 id="reference-solution-evaluation" className="text-base font-semibold tracking-tight">
            {t("evaluation")}
          </h2>
          <ReferenceRunControls
            solutionId={solutionId}
            canResubmit={solution.can.evaluate === true}
          />
          {!isCurrentRun && (
            <p className="rounded-lg border border-warning bg-warning/10 p-3 text-sm">
              {t("runs.notCurrent")}
            </p>
          )}
          {selected ? (
            <>
              <EvaluationResults solution={selected} environment={solution.environmentId} />
              <div>
                <a
                  href={`/api/reference-solutions/submissions/${selected.id}/result`}
                  className={buttonClasses("outline", "sm")}
                >
                  {t("runs.downloadResult")}
                </a>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("neverEvaluated")}</p>
          )}
        </section>

        {solution.submissions.length > 1 && (
          <section aria-labelledby="reference-solution-history" className="flex flex-col gap-2">
            <h2 id="reference-solution-history" className="text-base font-semibold tracking-tight">
              {t("history")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("historyExplain")}</p>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
              {solution.submissions.map((submission) => {
                const state = evaluationStatus({ lastSubmission: submission, maxPoints: 1 });
                const current = submission.id === selected?.id;
                return (
                  <li
                    key={submission.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                  >
                    <Link
                      href={`${solutionPath}?submission=${submission.id}`}
                      aria-current={current ? "true" : undefined}
                      className={`hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                        current ? "font-semibold" : ""
                      }`}
                    >
                      <DateTime unixSeconds={submission.submittedAt} withSeconds />
                    </Link>
                    <span className="flex flex-wrap items-center gap-2">
                      {submission.isDebug && <Badge tone="info">{t("runs.debug")}</Badge>}
                      <Badge tone={EVALUATION_TONE[state]}>{t(`status.${state}`)}</Badge>
                      <a
                        href={`/api/reference-solutions/submissions/${submission.id}/result`}
                        className={buttonClasses("outline", "xs")}
                      >
                        {t("runs.result")}
                      </a>
                      {canDeleteRuns && (
                        <DeleteReferenceSubmission
                          submissionId={submission.id}
                          selected={current}
                          solutionPath={solutionPath}
                        />
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* A reference solution has a thread like any other solution -- the legacy app's shared
            `SolutionDetail` mounts one for both kinds, and this is where a note about why the
            answer is written this way belongs. */}
        <Discussion
          threadId={solutionId}
          subject="referenceSolution"
          canModerate={solution.can.update === true}
        />
      </div>
    </PageShell>
  );
}
