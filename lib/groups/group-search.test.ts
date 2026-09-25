import { describe, expect, it } from "vitest";

import { fold, fullPath, matchingGroups } from "./group-search";
import { groupRows } from "./tree-rows";

/** The operator's own tree, as the catalogue filter offers it (the screenshot on X-022). */
const TREE = [
  { name: "Katedra Informatiky", path: ["Univerzita Palackého v Olomouci"] },
  { name: "Výuka", path: ["Univerzita Palackého v Olomouci", "Katedra Informatiky"] },
  {
    name: "KMI/ALGO1 - Alg. 1",
    path: ["Univerzita Palackého v Olomouci", "Katedra Informatiky", "Výuka"],
  },
  {
    name: "ALGO1 - Úterý",
    path: ["Univerzita Palackého v Olomouci", "Katedra Informatiky", "Výuka", "KMI/ALGO1 - Alg. 1"],
  },
  {
    name: "KMI/JP - Jazyk Python",
    path: ["Univerzita Palackého v Olomouci", "Katedra Informatiky", "Výuka"],
  },
  {
    name: "2025/26 - Jazyk Python (36b)",
    path: [
      "Univerzita Palackého v Olomouci",
      "Katedra Informatiky",
      "Výuka",
      "KMI/JP - Jazyk Python",
    ],
  },
  { name: "Test", path: ["Univerzita Palackého v Olomouci"] },
];

describe("matchingGroups", () => {
  it("returns everything for an empty query", () => {
    expect(matchingGroups(TREE, "   ")).toHaveLength(TREE.length);
  });

  it("brings back a course and everything beneath it", () => {
    // The whole point of the ticket: one query, and the relationship between the two is on screen.
    expect(matchingGroups(TREE, "KMI/JP").map((group) => group.name)).toEqual([
      "KMI/JP - Jazyk Python",
      "2025/26 - Jazyk Python (36b)",
    ]);
  });

  it("ignores case and diacritics", () => {
    expect(matchingGroups(TREE, "utery").map((group) => group.name)).toEqual(["ALGO1 - Úterý"]);
    expect(matchingGroups(TREE, "VÝUKA")).toHaveLength(5);
  });

  it("keeps punctuation, so a course code is not a fuzzy match", () => {
    // Were the slash stripped, "KMI/JP" would also match "KMI/ALGO1 ... " through its own path.
    expect(matchingGroups(TREE, "kmi/jp").every((group) => fullPath(group).includes("JP"))).toBe(
      true,
    );
  });

  it("matches nothing rather than everything when nothing matches", () => {
    expect(matchingGroups(TREE, "seminář z kvantové mechaniky")).toEqual([]);
  });

  it("hands groupRows a list that still reads as a tree", () => {
    // Matches keep their ancestors, so the indentation the filter draws is the real hierarchy and
    // not an artefact of which rows happened to survive.
    const rows = groupRows(
      matchingGroups(TREE, "jazyk python").map((group, index) => ({ ...group, id: `g${index}` })),
    );
    expect(rows.map((row) => `${row.depth} ${row.kind} ${row.name}`)).toEqual([
      "0 heading Univerzita Palackého v Olomouci",
      "1 heading Katedra Informatiky",
      "2 heading Výuka",
      "3 group KMI/JP - Jazyk Python",
      "4 group 2025/26 - Jazyk Python (36b)",
    ]);
  });
});

describe("fold", () => {
  it("leaves a course code recognisable", () => {
    expect(fold("KMI/ALGO1 - Alg. 1")).toBe("kmi/algo1 - alg. 1");
  });
});
