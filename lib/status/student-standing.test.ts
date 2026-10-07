import { describe, expect, it } from "vitest";

import { isStudentVisible, studentStanding, type StandingInput } from "./student-standing";

const item = (maxPoints: number, { isBonus = false, visible = true } = {}) => ({
  maxPoints,
  isBonus,
  visible,
});

const assignmentRow = (
  id: string,
  gained: number | null,
  { bonus = 0, best = gained !== null } = {},
) => ({ id, points: { gained, bonus }, bestSolutionId: best ? `${id}-best` : null });

const shadowRow = (id: string, gained: number | null) => ({ id, points: { gained } });

function input(overrides: Partial<StandingInput>): StandingInput {
  return {
    stats: { assignments: [], shadowAssignments: [] },
    assignments: new Map(),
    shadows: new Map(),
    threshold: null,
    pointsLimit: null,
    attempted: null,
    graded: null,
    ...overrides,
  };
}

describe("studentStanding", () => {
  it("reads the operator's case as the student does: 12/10, not 12/100", () => {
    const shadows = new Map([
      ["s1", item(10)],
      ...Array.from({ length: 9 }, (_, i) => [`h${i}`, item(10, { visible: false })] as const),
    ]);
    const standing = studentStanding(
      input({
        stats: {
          assignments: [assignmentRow("a1", 2), assignmentRow("a2", 1), assignmentRow("a3", 1)],
          shadowAssignments: [
            shadowRow("s1", 8),
            ...[...shadows.keys()].slice(1).map((id) => shadowRow(id, null)),
          ],
        },
        assignments: new Map([
          ["a1", item(5, { isBonus: true })],
          ["a2", item(5, { isBonus: true })],
          ["a3", item(5, { isBonus: true })],
        ]),
        shadows,
        threshold: 0.5,
      }),
    );
    expect(standing).toMatchObject({ gained: 12, total: 10, hasLimit: true, passesLimit: true });
  });

  it("leaves hidden work out of both the points and the maximum", () => {
    const standing = studentStanding(
      input({
        stats: {
          assignments: [assignmentRow("open", 4), assignmentRow("hidden", 9)],
          shadowAssignments: [shadowRow("hiddenShadow", 7)],
        },
        assignments: new Map([
          ["open", item(10)],
          ["hidden", item(10, { visible: false })],
        ]),
        shadows: new Map([["hiddenShadow", item(10, { visible: false })]]),
      }),
    );
    expect(standing).toMatchObject({ gained: 4, total: 10, submittable: 1, gradable: 1 });
  });

  it("counts a bonus towards the points and never towards the maximum", () => {
    const standing = studentStanding(
      input({
        stats: {
          assignments: [assignmentRow("a", 8, { bonus: 2 }), assignmentRow("b", 3)],
          shadowAssignments: [],
        },
        assignments: new Map([
          ["a", item(10)],
          ["b", item(5, { isBonus: true })],
        ]),
      }),
    );
    expect(standing).toMatchObject({ gained: 13, total: 10 });
  });

  it("prefers an absolute points limit to a percentage", () => {
    const stats = { assignments: [assignmentRow("a", 6)], shadowAssignments: [] };
    const assignments = new Map([["a", item(10)]]);
    expect(
      studentStanding(input({ stats, assignments, pointsLimit: 7, threshold: 0.5 })),
    ).toMatchObject({ hasLimit: true, passesLimit: false });
    expect(studentStanding(input({ stats, assignments, threshold: 0.5 }))).toMatchObject({
      hasLimit: true,
      passesLimit: true,
    });
    expect(studentStanding(input({ stats, assignments }))).toMatchObject({
      hasLimit: false,
      passesLimit: true,
    });
  });

  it("counts an attempt that failed as submitted when the attempts are known", () => {
    const stats = {
      assignments: [
        assignmentRow("ok", 5),
        assignmentRow("failed", null),
        assignmentRow("none", null),
      ],
      shadowAssignments: [],
    };
    const assignments = new Map([
      ["ok", item(5)],
      ["failed", item(5)],
      ["none", item(5)],
    ]);
    expect(
      studentStanding(input({ stats, assignments, attempted: new Set(["ok", "failed"]) })),
    ).toMatchObject({ submitted: 2, submittable: 3 });
    expect(studentStanding(input({ stats, assignments }))).toMatchObject({
      submitted: 1,
      submittable: 3,
    });
  });

  it("counts graded work across assignments and shadow assignments", () => {
    const standing = studentStanding(
      input({
        stats: {
          assignments: [assignmentRow("a", 5), assignmentRow("b", 5), assignmentRow("c", 5)],
          shadowAssignments: [shadowRow("s", 0), shadowRow("t", null)],
        },
        assignments: new Map([
          ["a", item(5)],
          ["b", item(5)],
          ["c", item(5, { visible: false })],
        ]),
        shadows: new Map([
          ["s", item(10)],
          ["t", item(10)],
        ]),
        graded: new Set(["a", "c"]),
      }),
    );
    expect(standing).toMatchObject({ graded: 2, gradable: 4 });
  });

  it("does not claim a graded count it could not read", () => {
    expect(studentStanding(input({})).graded).toBeNull();
  });
});

describe("isStudentVisible", () => {
  it("needs the assignment published and its visibleFrom past", () => {
    expect(isStudentVisible({ isPublic: true, visibleFrom: null }, 100)).toBe(true);
    expect(isStudentVisible({ isPublic: true, visibleFrom: 100 }, 100)).toBe(true);
    expect(isStudentVisible({ isPublic: true, visibleFrom: 101 }, 100)).toBe(false);
    expect(isStudentVisible({ isPublic: false, visibleFrom: null }, 100)).toBe(false);
  });
});
