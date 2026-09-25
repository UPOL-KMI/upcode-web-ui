import { describe, expect, it } from "vitest";

import { groupRows } from "./tree-rows";

/** The operator's own tree, as the assign offer sees it: only the leaves are selectable. */
const TREE = [
  { id: "jp", name: "KMI/JP - 2025/26", path: ["Katedra informatiky", "Výuka", "Jazyk Python"] },
  { id: "exam", name: "Zkouškový předmět", path: ["Katedra informatiky", "Výuka"] },
];

describe("groupRows", () => {
  it("puts each container above its first child, once", () => {
    expect(groupRows(TREE).map((row) => `${row.depth} ${row.kind} ${row.name}`)).toEqual([
      "0 heading Katedra informatiky",
      "1 heading Výuka",
      "2 heading Jazyk Python",
      "3 group KMI/JP - 2025/26",
      // "Katedra informatiky" and "Výuka" are already shown and are not repeated; the second group
      // sits one level up, under "Výuka".
      "2 group Zkouškový předmět",
    ]);
  });

  it("gives a second branch its own headings rather than the previous branch's", () => {
    const rows = groupRows([
      { id: "a", name: "2025/26 ZS", path: ["Výuka", "Jazyk Python"] },
      { id: "b", name: "2025/26 ZS", path: ["Výuka", "Základy programování"] },
    ]);
    expect(rows.map((row) => `${row.kind}:${row.name}`)).toEqual([
      "heading:Výuka",
      "heading:Jazyk Python",
      "group:2025/26 ZS",
      // The container changed at depth 1, so that heading is emitted again for the new branch --
      // without this the second course's run would read as belonging to the first.
      "heading:Základy programování",
      "group:2025/26 ZS",
    ]);
  });

  it("keeps two groups of the same name apart by their own keys", () => {
    const rows = groupRows([
      { id: "a", name: "2025/26 ZS", path: ["Jazyk Python"] },
      { id: "b", name: "2025/26 ZS", path: ["Základy programování"] },
    ]);
    const keys = rows.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("prints a group that is also a container once", () => {
    // The catalogue filter (X-022) offers the course and the lab beneath it, so the course is both
    // a row somebody can choose and the heading its child hangs under. It is the former.
    const rows = groupRows([
      { id: "course", name: "KMI/JP - Jazyk Python", path: ["Výuka"] },
      { id: "lab", name: "2025/26 (36b)", path: ["Výuka", "KMI/JP - Jazyk Python"] },
    ]);
    expect(rows.map((row) => `${row.depth} ${row.kind} ${row.name}`)).toEqual([
      "0 heading Výuka",
      "1 group KMI/JP - Jazyk Python",
      "2 group 2025/26 (36b)",
    ]);
  });

  it("handles a group with no visible ancestors", () => {
    // A student may not see the faculty their course hangs under, so the path arrives empty and
    // the row is simply not indented.
    expect(groupRows([{ id: "a", name: "Sama o sobě", path: [] }])).toEqual([
      { kind: "group", key: "a", depth: 0, name: "Sama o sobě", id: "a" },
    ]);
  });

  it("returns nothing for nothing", () => {
    expect(groupRows([])).toEqual([]);
  });
});
