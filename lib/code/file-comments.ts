import type { ReviewComment } from "@/lib/api/solution-review";

/**
 * Ordering and numbering the comments on a file that has no lines (X-025).
 *
 * A review comment is `(file, line)` and core-api validates neither part, so a comment on a PDF is
 * already legal; what it lacks is a meaning for `line`. Here it is an **ordinal** -- first comment,
 * second comment -- so that several can be left on one document and shown in the order they were
 * meant to be read.
 *
 * **Nothing guarantees the ordinal is unique.** Two reviewers with the form open pick the same next
 * number, and core-api takes both. The order therefore falls back on the creation time, and the
 * display must never assume otherwise.
 */
export function sortFileComments(comments: readonly ReviewComment[]): ReviewComment[] {
  return [...comments].sort((a, b) => a.line - b.line || a.createdAt - b.createdAt);
}

/** The ordinal a new comment takes: one past the highest in use, or zero on an empty file. */
export function nextFileCommentLine(comments: readonly ReviewComment[]): number {
  return comments.reduce((highest, comment) => Math.max(highest, comment.line + 1), 0);
}
