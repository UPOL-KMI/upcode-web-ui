import { getTranslations } from "next-intl/server";

import type { FileContent, SolutionFileEntry } from "@/lib/api/solution-files";
import type { ReviewComment } from "@/lib/api/solution-review";
import { highlightToLines } from "@/lib/code/highlight";
import { formatBytes } from "@/lib/format/bytes";
import { isBinaryFilename } from "@/lib/code/binary-files";
import { isPreviewable, previewKindOf } from "@/lib/code/preview";
import { languageForFilename } from "@/lib/code/languages";

import { CodeBlock, CodeLine } from "@/components/code/code-block";
import { FileComments } from "@/components/solutions/file-comments";
import { FilePreview } from "@/components/solutions/file-preview";
import { ReviewableCode } from "@/components/solutions/reviewable-code";
import { Badge } from "@/components/status/badge";
import { buttonClasses } from "@/components/button";

/**
 * One submitted file, rendered (S-017), with its review comments where there are any (S-018).
 *
 * Highlighting happens here, on the server, whichever viewer is used below it -- so a reader
 * without a review to take part in downloads no JavaScript for this at all, and a reviewer
 * downloads tokens rather than a highlighter. The choice between the two viewers is made on what
 * the reader can actually do: the interactive one only where there is something to interact with.
 *
 * Anchors are prefixed per file (`main-c-L12`), because several files share one page and `#L12`
 * can only mean one of them.
 */
export function fileAnchorId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Everything the reviewable variant of this file needs, and nothing a plain reading of it does. */
export interface SourceFileReview {
  comments: ReviewComment[];
  /** Each comment's markdown, rendered on the server -- see `review-comment.tsx` (G-027). */
  bodies: Record<string, React.ReactNode>;
  canComment: boolean;
  canModerate: boolean;
  currentUserId: string;
  reviewClosed: boolean;
}

export interface SourceFileProps {
  solutionId: string;
  file: SolutionFileEntry;
  /** Null when core-api could not produce the content -- the file is still listed, with the reason. */
  content: FileContent | null;
  /**
   * Where this file can be downloaded on its own, for one this app will not render. Absent for an
   * entry inside a submitted archive, whose bytes exist only inside it, and for a reference
   * solution, which has no such route.
   */
  downloadHref?: string | null;
  contentError?: string;
  /**
   * Omitted where the file has no review and never will: a **reference** solution's (G-013), which
   * core-api gives no review of at all. The alternative was six dummy props at that call site.
   */
  review?: SourceFileReview;
}

export async function SourceFile({
  solutionId,
  file,
  content,
  contentError,
  downloadHref,
  review,
}: SourceFileProps) {
  const [t, code] = await Promise.all([getTranslations("Sources"), getTranslations("Code")]);
  const anchor = fileAnchorId(file.name);
  const language = languageForFilename(file.entry ?? file.name);

  // The name on the left, the size hard against the right edge -- the same shape whether the file
  // folds or not. When the chevron was added it went inside this group, which made `justify-between`
  // separate the chevron from everything else and left the size sitting against the name.
  const nameSide = (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-sm text-foreground">{file.name}</span>
      {file.isEntryPoint && <Badge tone="info">{t("entryPoint")}</Badge>}
    </span>
  );
  const sizeSide = <span className="text-sm text-muted-foreground">{formatBytes(file.size)}</span>;
  const captionInner = (
    <>
      {nameSide}
      {sizeSide}
    </>
  );

  const captionClass =
    "flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted px-4 py-2";

  const caption = <figcaption className={captionClass}>{captionInner}</figcaption>;

  // A file this app will not read as text: offered, not rendered. Two ways to land here -- the
  // name said so before anything was fetched (`isBinaryFilename`, the cheap case), or the bytes
  // came back and were not UTF-8, which is the backstop for a type nobody listed. Either way
  // showing the characters would be mojibake, and the reader wants the file itself.
  const unreadable =
    isBinaryFilename(file.entry ?? file.name) || content?.malformedCharacters === true;

  if (unreadable) {
    // **Shown where it can be, offered always, and commentable either way** (X-025). A preview
    // needs a download route to point at, so an entry inside a submitted archive gets none -- its
    // bytes exist only inside the zip and core-api has no endpoint that extracts one. It still
    // takes comments: those are bound to the file's name, not to a picture of it.
    const kind = downloadHref ? previewKindOf(file.name) : null;
    const previewable = kind !== null && isPreviewable(file.name, file.size);

    return (
      <details
        id={anchor}
        data-source-file
        open
        className="group overflow-hidden rounded-lg border border-border"
      >
        <summary
          className={`${captionClass} cursor-pointer list-none marker:content-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
        >
          <span className="flex flex-wrap items-center gap-2">
            <svg
              className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
            {nameSide}
          </span>
          {sizeSide}
        </summary>

        <div className="flex flex-col gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* A shown file needs no sentence: the preview is the answer. The other three cases
                each need a different one, and "this type is not shown" is the wrong thing to say
                about a PNG that was merely too big to be worth fetching. */}
            {!previewable && (
              <span className="text-sm text-muted-foreground">
                {downloadHref === null
                  ? t("inArchive")
                  : kind !== null
                    ? t("preview.tooLarge")
                    : t("notShown")}
              </span>
            )}
            {downloadHref && (
              <a href={downloadHref} className={buttonClasses("outline", "sm")}>
                {t("downloadFile")}
              </a>
            )}
          </div>

          {previewable && downloadHref && (
            <FilePreview kind={kind} href={`${downloadHref}?inline`} name={file.name} />
          )}
        </div>

        {review && (
          <FileComments
            solutionId={solutionId}
            fileName={file.name}
            comments={review.comments}
            bodies={review.bodies}
            canComment={review.canComment}
            canModerate={review.canModerate}
            currentUserId={review.currentUserId}
            reviewClosed={review.reviewClosed}
          />
        )}
      </details>
    );
  }

  if (content === null) {
    return (
      <figure id={anchor} className="flex flex-col overflow-hidden rounded-lg border border-border">
        {caption}
        <p className="px-4 py-3 text-sm text-muted-foreground">
          {contentError ?? t("contentUnavailable")}
        </p>
      </figure>
    );
  }

  const { lines, palette, rootStyle, highlighted } = await highlightToLines(
    content.content,
    language,
  );
  const interactive = review !== undefined && (review.canComment || review.comments.length > 0);

  // **A `<details>`, not a React accordion.** A submitted file can be thousands of lines, and the
  // operator asked to be able to fold them away; the browser already owns exactly that state, for
  // free, with keyboard support and with find-in-page able to reach inside. Making it React state
  // would mean a client component wrapped around every file -- and around the highlighted tokens,
  // which is the one thing on this page worth keeping off the client. Open by default: a reader
  // arriving here came to read the code. `ToggleAllFiles` above drives these by setting `open`,
  // which is why the element carries `data-source-file`.
  return (
    <details
      id={anchor}
      data-source-file
      open
      className="group overflow-hidden rounded-lg border border-border"
    >
      <summary
        className={`${captionClass} cursor-pointer list-none marker:content-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
      >
        <span className="flex flex-wrap items-center gap-2">
          {/* The default disclosure triangle is hidden above -- it renders differently in every
              browser and sits outside the padded row. This one is in the flow and turns with the
              element's own `open`, so nothing has to track it. */}
          <svg
            className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
          {nameSide}
        </span>
        {sizeSide}
      </summary>
      {content.tooLarge && (
        <p className="border-b border-border bg-warning/10 px-4 py-2 text-sm">{t("truncated")}</p>
      )}
      {!highlighted && (
        <p className="border-b border-border px-4 py-2 text-sm text-muted-foreground">
          {code("notHighlighted")}
        </p>
      )}
      {interactive ? (
        <ReviewableCode
          solutionId={solutionId}
          fileName={file.name}
          lines={lines}
          palette={palette}
          rootStyle={rootStyle}
          idPrefix={`${anchor}-`}
          comments={review.comments}
          bodies={review.bodies}
          canComment={review.canComment}
          canModerate={review.canModerate}
          currentUserId={review.currentUserId}
          reviewClosed={review.reviewClosed}
        />
      ) : (
        <CodeBlock rootStyle={rootStyle} palette={palette}>
          {lines.map((tokens, index) => (
            <CodeLine
              key={index}
              tokens={tokens}
              palette={palette}
              number={index + 1}
              idPrefix={`${anchor}-`}
              label={code("lineLabel", { line: index + 1 })}
            />
          ))}
        </CodeBlock>
      )}
    </details>
  );
}
