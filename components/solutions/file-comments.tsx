"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { ReviewComment } from "@/lib/api/solution-review";
import { addReviewComment } from "@/lib/actions/solution-review";
import { nextFileCommentLine, sortFileComments } from "@/lib/code/file-comments";

import { ReviewCommentForm, ReviewCommentItem } from "@/components/solutions/review-comment";
import { buttonClasses } from "@/components/button";

/**
 * Comments on a file that has no lines to pin them to (X-025).
 *
 * A review comment is `(file, line)`, and a PDF has no line twelve. core-api validates neither
 * field -- `file` is a free string and `line` a bare integer -- so a comment on `report.pdf` was
 * always accepted; what was missing was anywhere to write or read one, because the only comment
 * surface was the code viewer. This is that surface for everything else.
 *
 * **`line` is an ordinal here, not a line.** Several comments on one file are wanted -- a marker
 * works through a document and says several things -- so they are stored as 0, 1, 2 … and shown in
 * that order. Nothing stops two reviewers picking the same number, since nothing validates it, so
 * the order falls back on the creation time and never depends on the ordinal being unique.
 *
 * **The author sees this too.** `SourceFile` renders for both roles, and core-api discloses a
 * review only once it is closed; a comment on a file that cannot be rendered would otherwise be
 * written into nothing.
 */
export function FileComments({
  solutionId,
  fileName,
  comments,
  bodies,
  canComment,
  canModerate,
  currentUserId,
  reviewClosed,
  floating = false,
}: {
  solutionId: string;
  fileName: string;
  comments: ReviewComment[];
  bodies: Record<string, React.ReactNode>;
  canComment: boolean;
  canModerate: boolean;
  currentUserId: string;
  reviewClosed: boolean;
  /**
   * On a wide screen, a window at the bottom right of the screen for as long as its file is on it,
   * rather than a band under the file: an image or a PDF is read at the card's full width, and its
   * comments stay at hand however far down it is scrolled. **`position: sticky`, not a script**:
   * held to the bottom of the screen but never outside its own file, it comes into view with the
   * file, comes to rest under it once the file's end is in view, and the next file brings its own.
   * Its title names the file, so it is clear which one is being commented on. Folds to that title,
   * for the part of the file under it. Below `xl` it is the band as usual.
   */
  floating?: boolean;
}) {
  const t = useTranslations("Review");
  const [adding, setAdding] = useState(false);

  const [folded, setFolded] = useState(false);

  const ordered = sortFileComments(comments);
  if (ordered.length === 0 && !canComment) return null;

  const title = (
    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {t("comment.onFile")}
      {floating && ordered.length > 0 && <span className="xl:hidden"> ({ordered.length})</span>}
    </h4>
  );

  return (
    <section
      aria-label={floating ? t("comment.onFileNamed", { name: fileName }) : undefined}
      className={`flex flex-col gap-2 border-t border-border px-4 py-3 ${
        floating
          ? "xl:sticky xl:bottom-4 xl:z-20 xl:mx-4 xl:mb-4 xl:ml-auto xl:max-h-[60vh] xl:w-[26rem] xl:overflow-y-auto xl:rounded-lg xl:border xl:bg-card xl:shadow-lg"
          : ""
      }`}
    >
      {floating ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {title}
            <p className="hidden truncate text-xs text-muted-foreground xl:block">
              {fileName}
              {ordered.length > 0 && ` · ${ordered.length}`}
            </p>
          </div>
          <button
            type="button"
            className={buttonClasses("ghost", "xs", "hidden xl:inline-flex")}
            aria-expanded={!folded}
            onClick={() => setFolded((value) => !value)}
          >
            {folded ? t("comment.unfold") : t("comment.fold")}
          </button>
        </div>
      ) : (
        title
      )}

      <div className={`flex flex-col gap-2 ${floating && folded ? "xl:hidden" : ""}`}>
        {ordered.map((comment) => (
          <ReviewCommentItem
            key={comment.id}
            solutionId={solutionId}
            comment={comment}
            body={bodies[comment.id]}
            canModify={canComment && (canModerate || comment.authorId === currentUserId)}
            reviewClosed={reviewClosed}
          />
        ))}

        {adding ? (
          <div className="border-l-2 border-primary bg-card">
            <ReviewCommentForm
              submitLabel={t("comment.add")}
              reviewClosed={reviewClosed}
              onCancel={() => setAdding(false)}
              onSubmitValues={(values) =>
                addReviewComment(solutionId, fileName, nextFileCommentLine(comments), values)
              }
              onDone={() => setAdding(false)}
            />
          </div>
        ) : (
          canComment && (
            <div>
              <button
                type="button"
                className={buttonClasses("outline", "sm")}
                onClick={() => setAdding(true)}
              >
                {t("comment.addOnFile")}
              </button>
            </div>
          )
        )}
      </div>
    </section>
  );
}
