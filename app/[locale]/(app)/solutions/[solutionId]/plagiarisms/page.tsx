import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import {
  getDetectedSimilarities,
  getPlagiarismBatch,
  type DetectedSimilarity,
  type SimilarFile,
} from "@/lib/api/plagiarism";
import { getFileContent, getSolutionFiles } from "@/lib/api/solution-files";
import { getSolutionDetail } from "@/lib/api/solution";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
import { formatSimilarity } from "@/lib/format/similarity";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { fragmentRanges, MarkedSource } from "@/components/solutions/marked-source";
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
  const t = await getTranslations({ locale, namespace: "Plagiarism" });
  return { title: t("title") };
}

/**
 * What a detection tool found in one solution (S-019) -- the legacy
 * `/app/assignment/:assignmentId/solution/:solutionId/plagiarisms` screen.
 *
 * **ReCodEx detects nothing itself.** An external tool runs elsewhere and uploads what it found;
 * a batch names that tool and when its upload finished. This page therefore reports rather than
 * accuses, and says which tool said it.
 *
 * Only a teacher gets here at all: core-api grants `viewDetectedPlagiarisms` from
 * `supervisor-student` upwards on an observed group, and omits the solution's `plagiarism` field
 * for everyone else -- so the author of a solution cannot read the report about their own work,
 * which is the legacy behaviour and a deliberate one.
 *
 * Which pair of files is shown is `?similarity=` on the URL, so a supervisor can send a colleague
 * the exact comparison they are looking at rather than "the third one down".
 */
export default async function SolutionPlagiarismsPage({
  params,
  searchParams,
}: {
  params: Promise<{ solutionId: string }>;
  searchParams: Promise<{ similarity?: string }>;
}) {
  const [{ solutionId }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const [t, solution] = await Promise.all([
    getTranslations("Plagiarism"),
    getSolutionDetail(solutionId, locale),
  ]);

  if (!solution.can.viewDetectedPlagiarisms) forbidden();

  const breadcrumbs = await resolveBreadcrumbs(`/solutions/${solutionId}/plagiarisms`, locale);
  const shell = (children: React.ReactNode) => (
    <PageShell
      title={t("title")}
      subtitle={`${solution.assignmentName} — ${t("attempt", { attempt: solution.attemptIndex })}`}
      breadcrumbs={breadcrumbs}
      actions={
        <Link href={`/solutions/${solutionId}`} className={buttonClasses("outline", "sm")}>
          <BackIcon />
          {t("backToSolution")}
        </Link>
      }
    >
      {children}
    </PageShell>
  );

  if (!solution.plagiarismBatchId) {
    return shell(<EmptyState title={t("empty.title")} description={t("empty.description")} />);
  }

  const [batch, similarities, files] = await Promise.all([
    getPlagiarismBatch(solution.plagiarismBatchId),
    getDetectedSimilarities(solution.plagiarismBatchId, solutionId),
    getSolutionFiles(solutionId),
  ]);

  if (similarities.length === 0) {
    return shell(<EmptyState title={t("empty.title")} description={t("empty.description")} />);
  }

  const selected =
    similarities.find((record) => record.id === query.similarity) ?? similarities[0]!;

  const testedName =
    files.find(
      (file) =>
        file.fileId === selected.solutionFileId &&
        (file.entry ?? "") === (selected.fileEntry || ""),
    )?.name ?? selected.fileEntry;

  return shell(
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {t("batch", { tool: batch.detectionTool || t("unknownTool") })}
        </p>
        {batch.uploadCompletedAt !== null && (
          <p className="text-sm text-muted-foreground">
            {t("checkedAt")} <DateTime unixSeconds={batch.uploadCompletedAt} />
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">{t("matches")}</h2>
        <ul className="flex flex-col gap-2">
          {similarities.map((record) => (
            <li key={record.id}>
              <SimilarityRow
                solutionId={solutionId}
                record={record}
                selected={record.id === selected.id}
                label={t("byAuthor", {
                  name: record.authorName || t("unknownAuthor"),
                  percent: formatSimilarity(record.similarity),
                })}
                selectLabel={t("show")}
                selectedLabel={t("showing")}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">
          {t("comparison", {
            name: selected.authorName || t("unknownAuthor"),
            file: testedName,
          })}
        </h2>
        <Comparison solutionId={solutionId} similarity={selected} testedName={testedName} />
      </section>
    </div>,
  );
}

function SimilarityRow({
  solutionId,
  record,
  selected,
  label,
  selectLabel,
  selectedLabel,
}: {
  solutionId: string;
  record: DetectedSimilarity;
  selected: boolean;
  label: string;
  selectLabel: string;
  selectedLabel: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm ${
        selected ? "border-primary bg-accent/40" : "border-border"
      }`}
    >
      <span>{label}</span>
      {selected ? (
        <span className="text-xs text-muted-foreground">{selectedLabel}</span>
      ) : (
        <Link
          href={`/solutions/${solutionId}/plagiarisms?similarity=${record.id}`}
          className={buttonClasses("outline", "xs")}
        >
          {selectLabel}
        </Link>
      )}
    </div>
  );
}

/**
 * The two sides, one above the other on a narrow screen and side by side on a wide one.
 *
 * The other author's file is only fetched when core-api says this reader may open that solution
 * (`canViewDetail` on the nested solution) -- a supervisor of one group may be shown a match
 * against a solution submitted in a group they have nothing to do with, and the report still says
 * so, without the source.
 */
async function Comparison({
  solutionId,
  similarity,
  testedName,
}: {
  solutionId: string;
  similarity: DetectedSimilarity;
  testedName: string;
}) {
  const t = await getTranslations("Plagiarism");
  const tested = await getFileContent(similarity.solutionFileId, similarity.fileEntry || null);

  return (
    <div className="flex flex-col gap-6">
      {similarity.files.map((file) => (
        <div key={file.id} className="grid gap-4 xl:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("thisSolution", { file: testedName })}</h3>
            <MarkedSource
              content={tested.content}
              ranges={fragmentRanges(file.fragments, "tested")}
              label={t("thisSolution", { file: testedName })}
            />
          </div>
          <OtherSide file={file} solutionId={solutionId} />
        </div>
      ))}
    </div>
  );
}

async function OtherSide({ file, solutionId }: { file: SimilarFile; solutionId: string }) {
  const t = await getTranslations("Plagiarism");
  const name = file.fileName || file.fileEntry || t("unknownFile");

  const content =
    file.canViewSolution && file.solutionFileId
      ? await getFileContent(file.solutionFileId, file.fileEntry || null)
      : null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {t("otherSolution", { file: name })}
        {file.solutionId && file.canViewSolution && file.solutionId !== solutionId && (
          <Link
            href={`/solutions/${file.solutionId}`}
            className={buttonClasses("outline", "xs", "font-normal")}
          >
            {file.attemptIndex !== null
              ? t("openAttempt", { attempt: file.attemptIndex })
              : t("openSolution")}
          </Link>
        )}
      </h3>
      {file.createdAt !== null && (
        <p className="text-xs text-muted-foreground">
          {t("submittedAt")} <DateTime unixSeconds={file.createdAt} />
          {file.environment && ` · ${file.environment}`}
        </p>
      )}
      {content ? (
        <MarkedSource
          content={content.content}
          ranges={fragmentRanges(file.fragments, "other")}
          label={t("otherSolution", { file: name })}
        />
      ) : (
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
          {t("otherNotVisible")}
        </p>
      )}
    </div>
  );
}
