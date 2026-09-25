import { describe, expect, it } from "vitest";

import type { ReviewComment } from "@/lib/api/solution-review";
import { nextFileCommentLine, sortFileComments } from "./file-comments";

function comment(line: number, createdAt: number, id = `${line}-${createdAt}`): ReviewComment {
  return {
    id,
    authorId: "u1",
    authorName: "Teacher",
    createdAt,
    file: "report.pdf",
    line,
    text: "",
    issue: false,
  };
}

describe("nextFileCommentLine", () => {
  it("starts at zero on a file nobody has commented on", () => {
    expect(nextFileCommentLine([])).toBe(0);
  });

  it("takes one past the highest in use, not the count", () => {
    expect(nextFileCommentLine([comment(0, 1), comment(1, 2)])).toBe(2);
    // A deleted middle comment leaves a gap; the next one must not reuse an ordinal in use.
    expect(nextFileCommentLine([comment(0, 1), comment(7, 2)])).toBe(8);
  });
});

describe("sortFileComments", () => {
  it("orders by ordinal", () => {
    const ordered = sortFileComments([comment(2, 10), comment(0, 30), comment(1, 20)]);
    expect(ordered.map((c) => c.line)).toEqual([0, 1, 2]);
  });

  it("**falls back on creation time when two share an ordinal**, which nothing prevents", () => {
    const ordered = sortFileComments([comment(0, 300, "late"), comment(0, 100, "early")]);
    expect(ordered.map((c) => c.id)).toEqual(["early", "late"]);
  });

  it("does not modify what it was given", () => {
    const given = [comment(2, 10), comment(0, 20)];
    sortFileComments(given);
    expect(given.map((c) => c.line)).toEqual([2, 0]);
  });
});
