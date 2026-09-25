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
}: {
  solutionId: string;
  fileName: string;
  comments: ReviewComment[];
  bodies: Record<string, React.ReactNode>;
  canComment: boolean;
  canModerate: boolean;
  currentUserId: string;
  reviewClosed: boolean;
}) {
  const t = useTranslations("Review");
  const [adding, setAdding] = useState(false);

  const ordered = sortFileComments(comments);
  if (ordered.length === 0 && !canComment) return null;

  return (
    <section className="flex flex-col gap-2 border-t border-border px-4 py-3">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t("comment.onFile")}
      </h4>

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
    </section>
  );
}
