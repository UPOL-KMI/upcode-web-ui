import { describe, expect, it } from "vitest";

import { gradingEntries, gradingQueue, isGradedByPerson } from "./queue";

function solution(
  authorName: string,
  overrides: Partial<{
    id: string;
    authorId: string;
    isBest: boolean;
    overridden: number | null;
    bonus: number;
    reviewClosedAt: number | null;
  }> = {},
) {
  return {
    id: overrides.id ?? `s-${authorName}`,
    authorId: overrides.authorId ?? `u-${authorName}`,
    authorName,
    isBest: overrides.isBest ?? true,
    overridden: overrides.overridden ?? null,
    bonus: overrides.bonus ?? 0,
    reviewClosedAt: overrides.reviewClosedAt ?? null,
  };
}

describe("isGradedByPerson", () => {
  it("counts points set by hand, a bonus and a closed review, and nothing else", () => {
    expect(isGradedByPerson({ overridden: null, bonus: 0, reviewClosedAt: null })).toBe(false);
    // A deliberate nought is a decision, unlike the summary screens' guess from the points.
    expect(isGradedByPerson({ overridden: 0, bonus: 0, reviewClosedAt: null })).toBe(true);
    expect(isGradedByPerson({ overridden: null, bonus: -2, reviewClosedAt: null })).toBe(true);
    // "Mark as reviewed": the automatic points stand and the teacher has seen the code.
    expect(isGradedByPerson({ overridden: null, bonus: 0, reviewClosedAt: 1 })).toBe(true);
  });
});

describe("gradingEntries", () => {
  it("keeps one entry per student, on their best solution, in name order", () => {
    const entries = gradingEntries([
      solution("Svoboda"),
      solution("Novák", { id: "old", isBest: false }),
      solution("Novák", { id: "best" }),
      solution("Dvořák"),
    ]);

    expect(entries.map((entry) => entry.fullName)).toEqual(["Dvořák", "Novák", "Svoboda"]);
    expect(entries.find((entry) => entry.fullName === "Novák")?.solutionId).toBe("best");
  });

  it("leaves out a student with no best solution -- there is nothing to open", () => {
    const entries = gradingEntries([solution("Novák", { isBest: false }), solution("Svoboda")]);
    expect(entries.map((entry) => entry.fullName)).toEqual(["Svoboda"]);
  });

  it("orders namesakes by id, so the order holds between two loads", () => {
    const entries = gradingEntries([
      solution("Novák", { authorId: "b", id: "sb" }),
      solution("Novák", { authorId: "a", id: "sa" }),
    ]);
    expect(entries.map((entry) => entry.userId)).toEqual(["a", "b"]);
  });
});

describe("gradingQueue", () => {
  const entries = gradingEntries([
    solution("A", { reviewClosedAt: 1 }),
    solution("B"),
    solution("C", { overridden: 5 }),
    solution("D"),
  ]);

  it("places the current student and their neighbours", () => {
    const queue = gradingQueue(entries, "u-B")!;
    expect(queue.position).toBe(2);
    expect(queue.total).toBe(4);
    expect(queue.previous?.fullName).toBe("A");
    expect(queue.next?.fullName).toBe("C");
  });

  it("skips graded students when looking for the next ungraded one", () => {
    expect(gradingQueue(entries, "u-B")!.nextUngraded?.fullName).toBe("D");
  });

  it("wraps round to the start for the next ungraded one", () => {
    expect(gradingQueue(entries, "u-D")!.nextUngraded?.fullName).toBe("B");
  });

  it("has no plain next or previous past either end", () => {
    expect(gradingQueue(entries, "u-A")!.previous).toBeNull();
    expect(gradingQueue(entries, "u-D")!.next).toBeNull();
  });

  it("finds nobody once everyone else is graded, even if the current student is not", () => {
    const rest = gradingEntries([solution("A", { bonus: 1 }), solution("B")]);
    expect(gradingQueue(rest, "u-B")!.nextUngraded).toBeNull();
  });

  it("answers null for a student who is not in the queue", () => {
    expect(gradingQueue(entries, "u-nobody")).toBeNull();
  });
});
