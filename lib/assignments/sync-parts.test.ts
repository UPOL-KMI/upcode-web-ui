import { describe, expect, it } from "vitest";

import {
  FILES_AND_LINKS,
  SYNC_PARTS,
  defaultSelection,
  selectedParts,
  syncItems,
} from "./sync-parts";

const keysOf = (items: { key: string }[]) => items.map((item) => item.key);

describe("syncItems", () => {
  it("shows every part, drifted or not", () => {
    // A list of what is *not* on offer, and why, answers the question a shorter list leaves open.
    const { items } = syncItems(["limits"]);
    expect(items).toHaveLength(SYNC_PARTS.length - 1);
    expect(items.flatMap((item) => item.parts).sort()).toEqual([...SYNC_PARTS].sort());
  });

  it("lets the drifted parts be ticked and leaves the rest alone", () => {
    const { items } = syncItems(["limits"]);
    expect(keysOf(items.filter((item) => item.selectable && !item.matched))).toEqual(["limits"]);
    expect(items.find((item) => item.key === "scoreConfig")).toMatchObject({
      matched: true,
      selectable: false,
    });
  });

  it("never disables the texts, even when core-api calls them up to date", () => {
    // `areLocalizedTextsInSync` is true whenever the assignment's copy is not *older*, so an
    // override reports as up to date while differing -- and that is exactly what the texts form's
    // button exists to take back. Nothing core-api publishes tells the two apart.
    const { items } = syncItems([]);
    expect(items.find((item) => item.key === "localizedTexts")).toMatchObject({
      matched: true,
      selectable: true,
    });
    expect(items.filter((item) => item.selectable)).toHaveLength(1);
  });

  it("offers the files and the links into them as one box", () => {
    const { items } = syncItems(["fileLinks"]);
    const pair = items.find((item) => item.key === FILES_AND_LINKS);
    // Either half alone leaves the assignment inconsistent, so one drifted half drifts the pair.
    expect(pair).toEqual({
      key: FILES_AND_LINKS,
      parts: ["files", "fileLinks"],
      matched: false,
      selectable: true,
    });
  });

  it("hands back a part core-api grew later instead of dropping it", () => {
    const { items, unknown } = syncItems(["limits", "thirteenthThing"]);
    expect(unknown).toEqual(["thirteenthThing"]);
    expect(keysOf(items)).not.toContain("thirteenthThing");
  });
});

describe("defaultSelection", () => {
  it("ticks what drifted except the texts, coming from the drift notice", () => {
    // Syncing a text adjusted for one group destroys work with no undo; skipping one is fixed by
    // syncing again. The two mistakes are not symmetrical, so the default is not symmetrical.
    const { items } = syncItems(["localizedTexts", "files", "limits"]);
    expect(defaultSelection(items, "drift")).toEqual([FILES_AND_LINKS, "limits"]);
  });

  it("ticks the texts and nothing else, coming from the override notice", () => {
    const { items } = syncItems([]);
    expect(defaultSelection(items, "override")).toEqual(["localizedTexts"]);
  });
});

describe("selectedParts", () => {
  it("sends both names for the coupled box", () => {
    const { items } = syncItems(["files"]);
    expect(selectedParts(items, new Set([FILES_AND_LINKS]))).toEqual(["files", "fileLinks"]);
  });

  it("refuses to send a part the reader could not have ticked", () => {
    // Belt and braces against a stale selection surviving a refresh: an up-to-date part is not on
    // offer, and posting it would overwrite something nobody asked about.
    const { items } = syncItems([]);
    expect(selectedParts(items, new Set(["limits", "localizedTexts"]))).toEqual(["localizedTexts"]);
  });

  it("sends nothing for nothing ticked, which the caller must not post", () => {
    // An empty `syncOptions` is core-api's "everything", so an empty selection is the one case
    // that must never reach the endpoint.
    const { items } = syncItems(["limits"]);
    expect(selectedParts(items, new Set())).toEqual([]);
  });
});
