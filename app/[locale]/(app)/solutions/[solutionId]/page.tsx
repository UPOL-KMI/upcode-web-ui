import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCommentThread } from "@/lib/api/comments";
import {
  getSolutionDetail,
  getSolutionSubmissions,
  getSubmissionScoreConfig,
} from "@/lib/api/solution";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
import { formatPoints, formatPointsUnknown } from "@/lib/format/points";
import { evaluationStatus, testTallyOf } from "@/lib/status/evaluation";

import { Link } from "@/i18n/navigation";
import { EvaluationProgress } from "@/components/solutions/evaluation-progress";
import { EvaluationResults } from "@/components/solutions/evaluation-results";
import { DeleteSubmission } from "@/components/solutions/delete-submission";
import { ScoreConfigExplanation } from "@/components/solutions/score-config";
import { RerunControls } from "@/components/solutions/rerun-controls";
import { ReviewRequest } from "@/components/solutions/review-request";
import { VerdictControls } from "@/components/solutions/verdict-controls";
import { DateTime } from "@/components/format/date-time";
import { RelativeTime } from "@/components/format/relative-time";
import { PageShell } from "@/components/page-shell";
import { PageTabs, type PageTab } from "@/components/page-tabs";
import { Discussion } from "@/components/comments/discussion";
import { Badge } from "@/components/status/badge";
import { EvaluationBadge } from "@/components/status/evaluation-badge";
import { buttonClasses } from "@/components/button";
import { BonusPoints } from "@/components/format/bonus-points";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Solution" });
  return { title: t("pageTitle") };
}

/**
 * A submitted solution and its evaluation (S-015) -- where submitting lands, and where every
 * "Attempt N" link goes.
 *
 * `docs/IA.md` §4.4 describes two columns, evaluation beside source code. This builds the
 * evaluation one; the source viewer is S-017 and the inline review comments S-018, both of which
 * hang off the same page. Splitting them that way keeps each ticket's screen usable on its own
 * rather than shipping half of a two-column layout.
 *
 * Nothing here re-derives what the reader may see. Core-api nulls measured values, limit ratios and
 * judge logs per assignment flag, and `permissionHints` says whether they may set the review
 * request or the accepted flag -- this page renders what arrived.
 *
 * `?monitor=` (S-016) is the monitor channel of the job that is still running -- put there by the
 * submit form, since core-api hands the channel id out once, in the response to the submit that
 * created it, and never again. Without it the screen still updates itself; with it, it can say
 * which step the job is on.
 */
export default async function SolutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ solutionId: string }>;
  searchParams: Promise<{ monitor?: string; tasks?: string; submission?: string; tab?: string }>;
}) {
  const [{ solutionId }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const [t, tStatus, solution] = await Promise.all([
    getTranslations("Solution"),
    getTranslations("Status.evaluation"),
    getSolutionDetail(solutionId, locale),
  ]);
  const breadcrumbs = await resolveBreadcrumbs(`/solutions/${solutionId}`, locale);

  // The runs behind this solution (G-004). `viewResubmissions` is the *offer* to look through
  // them -- the legacy app's own gate -- while core-api gates the list itself on `viewDetail`, so
  // there is nothing to fetch for a reader who is not offered it.
  const showRuns = solution.can.viewResubmissions === true && solution.submissionCount > 1;
  const runs = showRuns ? await getSolutionSubmissions(solutionId) : [];
  const selected =
    query.submission === undefined
      ? null
      : (runs.find((run) => run.id === query.submission) ?? null);
  // An id that is not this solution's is a wrong address, not a silent fall back to the last run.
  if (query.submission !== undefined && selected === null) notFound();

  const shown = selected ?? solution;

  // One rule for the tally, shared with every list that shows it. Read here rather than counted
  // twice: this screen had its own copy for the screen-reader announcement, and the number beside
  // the verdict has to be the same number.
  const tally = testTallyOf({ evaluation: solution.evaluation });
  const solutionPath = `/solutions/${solutionId}`;
  // core-api refuses to delete the last run (`checkDeleteSubmission`), so this needs a second one.
  const canDeleteRuns = solution.can.deleteEvaluation === true && runs.length > 1;
  const scoreConfig =
    solution.can.viewEvaluation === true && (selected !== null || runs.length > 0)
      ? await getSubmissionScoreConfig((selected ?? runs[0]!).id)
      : null;

  const state = evaluationStatus(solution.status);
  const pending = state === "pending";
  // **A data-only solution has nothing to report and must not pretend otherwise.** No student code
  // ran, the judge's score is the default nought, and the points belong to whoever marks it. So the
  // percentage, the test table and the language are all absent, and what stands in their place is
  // either "waiting to be marked" or the points a teacher gave (DEC-141).
  const dataOnly = state === "awaiting-review" || state === "reviewed";

  /**
   * Three tabs, and the middle one is not always there (X-026).
   *
   * **A data-only exercise runs nothing**, so *Automatické testy* would be a tab that can never
   * fill; it is left out rather than shown empty. The reader's own address still works either way:
   * a `?tab=` naming a tab that does not exist here falls back to the first rather than rendering
   * nothing, so a link sent between two teachers cannot land on a blank page.
   *
   * Points are awarded in *Přehled*, on purpose -- it is the most common thing a teacher does on
   * this screen and it does not belong behind a tab nobody opened.
   */
  const hasAutomaticTests = !dataOnly;
  /**
   * The thread, read here for the number on its tab.
   *
   * **This is the one cost of the badge**: before it, the discussion was fetched only when its own
   * tab was open, and now every load of this screen asks for it. It is one GET and
   * `getCommentThread` is `cache`d, so the `Discussion` below reuses this very answer rather than
   * asking again -- the extra request is paid on the two tabs that do not show the thread, and
   * buys the reader the count without opening it.
   */
  const thread = await getCommentThread(solutionId);
  const tabs: PageTab[] = [
    { id: "overview", label: t("tabs.overview") },
    // "2/3" rather than a count: what is worth knowing before opening the tab is how much passed,
    // and the pill is left off entirely while there is nothing to count -- a pending evaluation
    // has no test results, and "0/0" would read like a failure rather than like a wait.
    ...(hasAutomaticTests
      ? [
          {
            id: "tests",
            label: t("tabs.tests"),
            badge: tally ? `${tally.passed}/${tally.total}` : undefined,
          },
        ]
      : []),
    { id: "discussion", label: t("tabs.discussion"), count: thread?.comments.length ?? 0 },
  ];
  /**
   * **A job to watch opens on the tab that shows it.** A submit and a re-run both land here with
   * `?monitor=`, and the progress island lives under *Automatické testy* -- landing on *Přehled*
   * would have meant watching an evaluation from the one screen that does not show it. An explicit
   * `?tab=` still wins, because a reader who asked for a tab asked for it.
   */
  const defaultTab =
    hasAutomaticTests && (pending || query.monitor !== undefined || query.submission !== undefined)
      ? "tests"
      : "overview";
  const currentTab = tabs.some((tab) => tab.id === query.tab) ? query.tab! : defaultTab;
  /**
   * Where the machinery goes when it has no tab of its own.
   *
   * A data-only submission has no *Automatické testy*, but it still has the things that would have
   * lived there and still mean something: the box that says it is waiting to be marked, the way on
   * to the student's files, and -- the one that would really have been missed -- the button that
   * deletes the solution. Hiding a tab must not hide those with it, so on a data-only submission
   * they fall back to *Přehled*.
   */
  const machineryTab = hasAutomaticTests ? "tests" : "overview";
  /**
   * Rendered in one of two places, because the order is not the same in both.
   *
   * On *Automatické testy* it comes first: re-running is what a teacher reaches for before reading
   * the result it will replace. On a data-only *Přehled* the only thing left of it is the delete
   * button -- there is nothing to run again -- and a destructive button belongs after what it
   * would destroy, not between the points and the verdict.
   */
  const rerunControls = (
    <RerunControls
      solutionId={solution.id}
      assignmentId={solution.assignmentId}
      canResubmit={solution.canResubmit}
      canDelete={solution.can.delete === true}
      dataOnly={dataOnly}
    />
  );
  const expectedTasks = Number.parseInt(query.tasks ?? "", 10);
  const announcement = solution.failure
    ? t("evaluation.announce.failed")
    : !solution.evaluation
      ? t("evaluation.announce.pending")
      : solution.evaluation.initFailed
        ? t("evaluation.announce.initFailed")
        : // A count of tests is not what happened to a data-only submission, and a screen reader
          // must not be told something the screen deliberately does not say.
          dataOnly
          ? t(`evaluation.announce.${state === "reviewed" ? "reviewed" : "awaitingReview"}`)
          : t("evaluation.announce.done", {
              passed: tally?.passed ?? 0,
              total: tally?.total ?? 0,
            });

  return (
    <PageShell
      title={t("title", { attempt: solution.attemptIndex })}
      subtitle={solution.assignmentName}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {solution.isBest && <Badge tone="success">{t("flags.best")}</Badge>}
          {solution.accepted && <Badge tone="info">{t("flags.accepted")}</Badge>}
          {solution.reviewClosedAt !== null ? (
            <Badge>{t("flags.reviewed")}</Badge>
          ) : solution.reviewStartedAt !== null ? (
            <Badge tone="warning">{t("flags.reviewOpen")}</Badge>
          ) : solution.reviewRequested ? (
            <Badge tone="warning">{t("flags.reviewRequested")}</Badge>
          ) : null}
          {solution.plagiarismBatchId !== null && (
            <Link
              href={`/solutions/${solutionId}/plagiarisms`}
              className="rounded-md border border-warning/60 px-3 py-1.5 text-sm text-foreground hover:bg-warning/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("plagiarisms")}
            </Link>
          )}
          <Link
            href={`/solutions/${solutionId}/sources`}
            className={buttonClasses("outline", "sm")}
          >
            {t("solutionFiles")}
          </Link>
          <Link
            href={`/assignments/${solution.assignmentId}`}
            className={buttonClasses("outline", "sm")}
          >
            {t("backToAssignment")}
          </Link>
        </div>
      }
      tabs={
        <PageTabs
          basePath={solutionPath}
          tabs={tabs}
          current={currentTab}
          label={t("tabs.label")}
        />
      }
    >
      <div className="flex flex-col gap-8">
        {currentTab === "overview" && (
          <section aria-labelledby="solution-summary">
            <h2 id="solution-summary" className="mb-3 text-base font-semibold tracking-tight">
              {t("summary")}
            </h2>
            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              <div className="flex justify-between gap-4 border-b border-border py-2">
                <dt className="text-sm text-muted-foreground">{t("points")}</dt>
                <dd className="text-sm font-medium tabular-nums">
                  {state === "awaiting-review" ? (
                    // `?/10` rather than words, so the number reads like the same number everywhere
                    // else -- and like a question rather than a grade.
                    <span className="text-muted-foreground">
                      {formatPointsUnknown(solution.maxPoints)}
                    </span>
                  ) : (
                    formatPoints(solution.gained ?? 0, solution.maxPoints)
                  )}
                  <BonusPoints bonus={solution.bonus} />
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border py-2">
                {/* "Výsledek" is the wrong word for a submission nobody has judged; what the badge
                  carries there is a state. The operator's observation. */}
                <dt className="text-sm text-muted-foreground">
                  {dataOnly ? t("state") : t("result")}
                </dt>
                <dd className="flex flex-wrap items-center justify-end gap-2">
                  <EvaluationBadge solution={solution.status} />
                  {/* What the tests did, beside what the scoring made of it -- the two are different
                    facts and a weight of nought separates them. Not for a data-only submission,
                    where no test ran on the student's work at all. */}
                  {!dataOnly && tally && (
                    <span className="text-xs whitespace-nowrap text-muted-foreground">
                      {tStatus("testsPassed", { passed: tally.passed, total: tally.total })}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border py-2">
                <dt className="text-sm text-muted-foreground">{t("submitted")}</dt>
                <dd className="flex flex-wrap items-center gap-2 text-sm">
                  <DateTime unixSeconds={solution.createdAt} withSeconds />
                  <span className="text-muted-foreground">
                    <RelativeTime unixSeconds={solution.createdAt} />
                  </span>
                </dd>
              </div>
              {/* The language of a submission nobody wrote code in is a fact about the machinery. */}
              {!dataOnly && (
                <div className="flex justify-between gap-4 border-b border-border py-2">
                  <dt className="text-sm text-muted-foreground">{t("environment")}</dt>
                  <dd className="text-sm">{solution.environment}</dd>
                </div>
              )}
              {solution.groupId && (
                <div className="flex justify-between gap-4 border-b border-border py-2">
                  <dt className="text-sm text-muted-foreground">{t("group")}</dt>
                  <dd className="text-sm">
                    <Link
                      href={`/groups/${solution.groupId}`}
                      className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {solution.groupName}
                    </Link>
                  </dd>
                </div>
              )}
              {solution.submissionCount > 1 && (
                <div className="flex justify-between gap-4 border-b border-border py-2">
                  <dt className="text-sm text-muted-foreground">{t("submissions")}</dt>
                  {/* Resubmissions are a teacher's tool: the same solution re-run against the
                    pipeline. Only the count is shown here -- listing them is T-003's screen. */}
                  <dd className="text-sm tabular-nums">{solution.submissionCount}</dd>
                </div>
              )}
              {solution.note && (
                <div className="flex justify-between gap-4 border-b border-border py-2 sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">{t("note")}</dt>
                  <dd className="text-sm">{solution.note}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {currentTab === "overview" && (
          <ReviewRequest
            solutionId={solution.id}
            requested={solution.reviewRequested}
            canRequest={solution.can.setFlagAsStudent === true || solution.can.setFlag === true}
            reviewStarted={solution.reviewStartedAt !== null}
            asTeacher={solution.can.setFlag === true}
          />
        )}

        {/* Awarding points lives with the overview: it is what a teacher came here to do. */}
        {currentTab === "overview" && (
          <VerdictControls
            solutionId={solution.id}
            accepted={solution.accepted}
            overridden={solution.overridden}
            bonus={solution.bonus}
            maxPoints={solution.maxPoints}
            canAccept={solution.can.setFlag === true}
            canSetPoints={solution.can.setBonusPoints === true}
          />
        )}

        {hasAutomaticTests && currentTab === "tests" && rerunControls}

        {currentTab === machineryTab && (
          <section aria-labelledby="solution-evaluation">
            <h2 id="solution-evaluation" className="mb-3 text-base font-semibold tracking-tight">
              {t("evaluation.heading")}
            </h2>
            {/* Outside `pending`, so the region is still mounted when the result replaces the
              progress island -- a live region inserted with its content announces nothing. */}
            <p role="status" aria-live="polite" className="sr-only">
              {announcement}
            </p>
            {pending && (
              <div className="mb-4">
                <EvaluationProgress
                  channelId={query.monitor ?? null}
                  monitorUrl={process.env.MONITOR_WS_URL ?? null}
                  expectedTasks={Number.isFinite(expectedTasks) ? expectedTasks : 0}
                />
              </div>
            )}
            {selected !== null && !dataOnly && (
              <p className="mb-3 rounded-lg border border-warning bg-warning/10 p-3 text-sm">
                {t("runs.notScored")}
              </p>
            )}
            {dataOnly ? (
              <div
                className={
                  state === "awaiting-review"
                    ? "rounded-lg border border-warning bg-warning-surface p-4 text-sm"
                    : "rounded-lg border border-success bg-success-surface p-4 text-sm"
                }
              >
                <p className="font-medium">
                  {state === "awaiting-review"
                    ? t("evaluation.awaitingReview.title")
                    : t("evaluation.reviewed.title", {
                        points: formatPoints(solution.gained ?? 0, solution.maxPoints),
                      })}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {state === "awaiting-review"
                    ? t("evaluation.awaitingReview.explain")
                    : t("evaluation.reviewed.explain")}
                </p>
              </div>
            ) : (
              <EvaluationResults solution={shown} environment={solution.environment} />
            )}
            {/* The second button to the student's files used to sit here, because this section is
                where a reader wants it next. Tabs took that away: it would be one of two links with
                the same name, and the copy behind a tab is the one nobody finds. The header carries
                it on every tab instead, which is what the operator asked the second copy for. */}
            {!dataOnly && (
              <div className="mt-3">
                <ScoreConfigExplanation scoreConfig={scoreConfig} />
              </div>
            )}
          </section>
        )}

        {currentTab === machineryTab && showRuns && (
          <section aria-labelledby="solution-runs" className="flex flex-col gap-2">
            <h2 id="solution-runs" className="text-base font-semibold tracking-tight">
              {t("runs.heading")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("runs.explain")}</p>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
              {runs.map((run, index) => {
                const current = selected === null ? index === 0 : run.id === selected.id;
                return (
                  <li
                    key={run.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
                  >
                    <Link
                      href={`${solutionPath}?submission=${run.id}`}
                      aria-current={current ? "true" : undefined}
                      className={`hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                        current ? "font-semibold" : ""
                      }`}
                    >
                      <DateTime unixSeconds={run.submittedAt} withSeconds />
                    </Link>
                    <span className="flex flex-wrap items-center gap-2">
                      {index === 0 && <Badge tone="info">{t("runs.scored")}</Badge>}
                      {run.isDebug && <Badge tone="info">{t("runs.debug")}</Badge>}
                      {solution.can.downloadResultArchive === true && (
                        <a
                          href={`/api/solutions/submissions/${run.id}/result`}
                          className={buttonClasses("outline", "xs")}
                        >
                          {t("runs.result")}
                        </a>
                      )}
                      {canDeleteRuns && (
                        <DeleteSubmission
                          submissionId={run.id}
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

        {dataOnly && currentTab === "overview" && rerunControls}

        {currentTab === "discussion" && (
          <Discussion
            threadId={solutionId}
            subject="solution"
            canModerate={solution.can.review === true}
            teacherIds={solution.groupTeacherIds}
          />
        )}
      </div>
    </PageShell>
  );
}
