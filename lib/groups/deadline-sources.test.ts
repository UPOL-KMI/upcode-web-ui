import { describe, expect, it } from "vitest";

import { deadlineSources } from "./deadline-sources";

const group = (id: string, organizational = false) => ({ id, organizational });

/** The operator's own tree: five courses he is named on, one inherited from `Výuka`. */
const MINE = {
  member: [group("studied")],
  teachingDirect: [group("jp-2025"), group("test")],
};

describe("deadlineSources", () => {
  it("leaves a course somebody only inherited out of both lists", () => {
    // The whole of X-017. `teaching` -- the wide set -- would also hold `algo1-utery`, another
    // teacher's course under a parent this reader administers; it is not passed in at all, and
    // passing it would be the regression.
    const sources = deadlineSources(MINE);
    expect(sources.teaching.map((g) => g.id)).toEqual(["jp-2025", "test"]);
    expect(sources.calendar.map((g) => g.id)).toEqual(["studied", "jp-2025", "test"]);
  });

  it("keeps the groups the reader studies in", () => {
    // Only the teaching half narrows: a student's own deadlines belong in their month whatever
    // they teach, and dropping them would make the calendar wrong for the people who need it most.
    expect(deadlineSources({ member: [group("studied")], teachingDirect: [] }).calendar).toEqual([
      group("studied"),
    ]);
  });

  it("does not put a group the reader both studies in and teaches twice in the calendar", () => {
    const both = { member: [group("shared")], teachingDirect: [group("shared")] };
    expect(deadlineSources(both).calendar).toEqual([group("shared")]);
  });

  it("drops containers, which provably hold no assignments", () => {
    const withContainers = {
      member: [group("faculty", true), group("studied")],
      teachingDirect: [group("department", true), group("jp-2025")],
    };
    const sources = deadlineSources(withContainers);
    expect(sources.teaching.map((g) => g.id)).toEqual(["jp-2025"]);
    expect(sources.calendar.map((g) => g.id)).toEqual(["studied", "jp-2025"]);
  });

  it("returns nothing for somebody who neither studies nor teaches", () => {
    expect(deadlineSources({ member: [], teachingDirect: [] })).toEqual({
      teaching: [],
      calendar: [],
    });
  });
});
