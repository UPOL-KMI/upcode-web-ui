import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getAssignmentSolutions } from "@/lib/api/assignment-solutions";
import {
  canDisplayFiles,
  getFileContent,
  getSolutionFiles,
  type SolutionFileEntry,
} from "@/lib/api/solution-files";
import { getSolutionDetail } from "@/lib/api/solution";
import { pairFilesByName, parseFilePairs } from "@/lib/code/diff";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";
import { DiffView } from "@/components/solutions/diff-view";
import { PairFilesByHand } from "@/components/solutions/pair-files-by-hand";
import { EmptyState } from "@/components/state/empty-state";
import { buttonClasses } from "@/components/button";
import { BackIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Diff" });
  return { title: t("title") };
}

/**
 * Two solutions, file by file (G-005) -- the brief §7 landmine this rewrite stepped on. The legacy
 * app ships `react-diff-viewer` for it; `INVENTORY.md` named the capability in three rows with
 * "keep capability" beside it, and nothing was built until now.
 *
 * **The route carries both solutions, so a comparison is a link.** That is the legacy URL's own
 * shape (`/diff/:secondSolutionId`) and it is what makes "look at these two" something a teacher
 * can send to a colleague. Swapping sides is the same route with the ids the other way round.
 *
 * **When the names differ, the reader says which goes with which (G-030), and the mapping is in
 * the address** -- `?pair=helper.py:utils.py`, repeatable. `localStorage` is where the legacy app
 * keeps it, and it cannot be where this app does: the pairing decides what the *server* fetches
 * and tokenises, so it has to arrive with the request. Putting it in the URL is also the better
 * answer for the same reason the two solution ids are in the path -- a comparison somebody set up
 * by hand is a link they can send (DEC-130).
 *
 * **Reviews are deliberately absent**, as they are in the legacy diff. A review is written against
 * one solution's lines; interleaved into an aligned two-file view its anchors would point at rows
 * that may belong to the other file, and a comment shown against the wrong line is worse than one
 * not shown at all. The sources screen is where a review is read.
 */
export default async function SolutionDiffPage({
  params,
  searchParams,
}: {
  params: Promise<{ solutionId: string; otherId: string }>;
  searchParams: Promise<{ pair?: string | string[] }>;
}) {
  const [{ solutionId, otherId }, query, locale] = await Promise.all([
    params,
    searchParams,
    getLocale(),
  ]);
  const overrides = parseFilePairs(query.pair);
  const [t, left, right] = await Promise.all([
    getTranslations("Diff"),
    getSolutionDetail(solutionId, locale),
    getSolutionDetail(otherId, locale),
  ]);

  // Comparing is a teacher's tool, and the hint that says so is the **assignment's**
  // `viewAssignmentSolutions` -- who may read other people's attempts. The solution's own
  // `viewDetail` is not it: an author has that for their own work, and gating on it would both
  // offer a student this screen and send them into an endpoint core-api refuses them. Checked on
  // *both* solutions, because the two may belong to different assignments.
  if (!left.canViewSolutions || !right.canViewSolutions) forbidden();

  const [leftFiles, rightFiles, breadcrumbs, siblings] = await Promise.all([
    getSolutionFiles(solutionId),
    getSolutionFiles(otherId),
    resolveBreadcrumbs(`/solutions/${solutionId}/sources`, locale),
    getAssignmentSolutions(left.assignmentId),
  ]);

  const tooBig = !canDisplayFiles(leftFiles) || !canDisplayFiles(rightFiles);
  const { pairs, onlyLeft, onlyRight } = pairFilesByName(leftFiles, rightFiles, overrides);

  const contents = tooBig
    ? []
    : await Promise.all(
        pairs.map(async (pair) => ({
          name: pair.left.name,
          // Named on both sides only where the two differ -- on an ordinary pair the second name
          // would be the first one repeated.
          otherName: pair.right.name === pair.left.name ? null : pair.right.name,
          left: await readOrEmpty(pair.left),
          right: await readOrEmpty(pair.right),
        })),
      );

  const label = (attempt: number, name: string) => t("attemptOf", { attempt, name });
  const leftLabel = label(left.attemptIndex, left.assignmentName);
  const rightLabel = label(right.attemptIndex, right.assignmentName);
  const others = siblings.filter(
    (row) => row.id !== solutionId && row.id !== otherId && row.authorId === left.authorId,
  );

  return (
    <PageShell
      title={t("title")}
      subtitle={t("subtitle", { left: leftLabel, right: rightLabel })}
      breadcrumbs={[...breadcrumbs.slice(0, -1), { label: t("title") }]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/solutions/${otherId}/diff/${solutionId}`}
            className={buttonClasses("outline", "sm")}
          >
            {t("swap")}
          </Link>
          <Link
            href={`/solutions/${solutionId}/sources`}
            className={buttonClasses("outline", "sm")}
          >
            <BackIcon />
            {t("backToSources")}
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-8">
        <p className="text-sm text-muted-foreground">
          {t("explain", { left: leftLabel, right: rightLabel })}
        </p>

        {tooBig ? (
          <EmptyState title={t("tooBig.title")} description={t("tooBig.description")} />
        ) : pairs.length === 0 ? (
          <EmptyState title={t("noPairs.title")} description={t("noPairs.description")} />
        ) : (
          contents.map((file) => (
            <DiffView
              key={file.name}
              name={file.otherName === null ? file.name : `${file.name} ↔ ${file.otherName}`}
              leftContent={file.left}
              rightContent={file.right}
              leftLabel={leftLabel}
              rightLabel={rightLabel}
            />
          ))
        )}

        {(onlyLeft.length > 0 || onlyRight.length > 0 || overrides.length > 0) && (
          <PairFilesByHand
            basePath={`/solutions/${solutionId}/diff/${otherId}`}
            onlyLeft={onlyLeft.map((file) => file.name)}
            onlyRight={onlyRight.map((file) => file.name)}
            overrides={overrides}
            leftLabel={leftLabel}
            rightLabel={rightLabel}
          />
        )}

        {others.length > 0 && (
          <section aria-labelledby="diff-others" className="flex flex-col gap-2">
            <h2 id="diff-others" className="text-base font-semibold tracking-tight">
              {t("others.title")}
            </h2>
            <ul className="flex flex-col gap-1 text-sm">
              {others.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/solutions/${solutionId}/diff/${row.id}`}
                    className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {t("otherAttempt", { attempt: row.attemptIndex })}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageShell>
  );
}

/** A file this app cannot read is compared as empty rather than failing the whole page (F-030). */
async function readOrEmpty(file: SolutionFileEntry): Promise<string> {
  try {
    const content = await getFileContent(file.fileId, file.entry);
    return content.malformedCharacters ? "" : content.content;
  } catch {
    return "";
  }
}
