/**
 * Which parts of an assignment a re-sync overwrites from its exercise, and which of them the
 * reader is offered (X-020).
 *
 * Its own module because two screens ask the same question with different answers, and because the
 * coupling below is a correctness rule rather than a layout choice -- a test is the right place for
 * it, not a comment in a component.
 */

/**
 * core-api's own `syncOptions` names, validated against exactly this list
 * (`AssignmentsPresenter::actionSyncWithExercise`); anything else is refused with
 * `Unknown sync option`. Ordered as the reader meets them, coarsest first.
 *
 * **An empty list means "all"**, not "none" (`Assignment::syncWithExercise` initialises every part
 * to `!$options`), which is why an empty selection must never reach the endpoint.
 */
export const SYNC_PARTS = [
  "localizedTexts",
  "files",
  "fileLinks",
  "exerciseTests",
  "exerciseConfig",
  "exerciseEnvironmentConfigs",
  "runtimeEnvironments",
  "configurationType",
  "scoreConfig",
  "limits",
  "hardwareGroups",
  "mergeJudgeLogs",
] as const;

export type SyncPart = (typeof SYNC_PARTS)[number];

export function isSyncPart(part: string): part is SyncPart {
  return (SYNC_PARTS as readonly string[]).includes(part);
}

/** The one checkbox that stands for both `files` and `fileLinks` -- see `syncItems`. */
export const FILES_AND_LINKS = "filesAndLinks";

export type SyncItemKey = Exclude<SyncPart, "files" | "fileLinks"> | typeof FILES_AND_LINKS;

/** One checkbox, and the core-api names it turns on. */
export interface SyncItem {
  key: SyncItemKey;
  parts: SyncPart[];
  /** core-api reports every part behind this box as already equal to the exercise's. */
  matched: boolean;
  /** Whether the reader may tick it at all -- see `syncItems`. */
  selectable: boolean;
}

const TEXTS: SyncPart = "localizedTexts";

const isTexts = (item: SyncItem) => item.parts.includes(TEXTS);

/**
 * Every part, marked with whether it has anything to offer.
 *
 * **All twelve are shown, not only the drifted ones.** A list of what is *not* on offer, and why,
 * answers the question a shorter list leaves open -- "is that everything, or is the rest hidden?"
 * A part that already matches the exercise is shown and cannot be ticked.
 *
 * **Except the texts, which are never disabled.** `upToDate` means a genuine equality check for
 * eleven of the twelve (`getExerciseConfig() === …`, `getExerciseTests()->contains(…)`, and so on),
 * but `Assignment::areLocalizedTextsInSync` returns true whenever the assignment's copy is not
 * *older* -- so a text somebody overrode for their own group reports as up to date while differing
 * from the exercise, and core-api publishes nothing that tells the two apart. Disabling it on that
 * evidence would lock away the one thing the override notice's button exists to do.
 *
 * **`files` and `fileLinks` are one checkbox, never two.** Both branches of `syncWithExercise`
 * clear the assignment's collection and refill it from the exercise, and a file link holds a
 * reference to an `ExerciseFile`: syncing the links alone points them at files the assignment does
 * not hold, and syncing the files alone leaves the existing links pointing at what was just
 * cleared. The pair counts as drifted when *either* half has, and always sends both names.
 *
 * An unrecognised stale part comes back separately rather than being dropped: `staleParts` renders
 * one as its raw key on purpose, so a thirteenth option core-api grows is visible -- but sending
 * that key back would be refused, so it is shown and cannot be chosen.
 */
export function syncItems(stale: readonly string[]): { items: SyncItem[]; unknown: string[] } {
  const drifted = new Set(stale);
  const items: SyncItem[] = [];

  for (const part of SYNC_PARTS) {
    if (part === "files" || part === "fileLinks") {
      if (items.some((item) => item.key === FILES_AND_LINKS)) continue;
      items.push(
        item(
          FILES_AND_LINKS,
          ["files", "fileLinks"],
          drifted.has("files") || drifted.has("fileLinks"),
        ),
      );
      continue;
    }
    items.push(item(part, [part], drifted.has(part)));
  }

  return { items, unknown: [...new Set(stale.filter((part) => !isSyncPart(part)))] };
}

function item(key: SyncItemKey, parts: SyncPart[], isStale: boolean): SyncItem {
  const matched = !isStale;
  return { key, parts, matched, selectable: !matched || parts.includes(TEXTS) };
}

/**
 * What starts ticked, which differs by where the reader pressed the button **on purpose**.
 *
 * From the drift notice, everything that has drifted **except the texts**: the two mistakes are not
 * symmetrical, because syncing a text somebody adjusted for their own group destroys work with no
 * undo, while skipping one is fixed by syncing again.
 *
 * From the override notice, **only the texts**: that button exists to take back an override, and
 * nothing else is being complained about there.
 */
export function defaultSelection(items: SyncItem[], from: "drift" | "override"): SyncItemKey[] {
  return items
    .filter((entry) => (from === "drift" ? !entry.matched && !isTexts(entry) : isTexts(entry)))
    .map((entry) => entry.key);
}

/** The core-api names behind the ticked boxes, in the order core-api lists them. */
export function selectedParts(items: SyncItem[], checked: ReadonlySet<string>): SyncPart[] {
  return items
    .filter((entry) => entry.selectable && checked.has(entry.key))
    .flatMap((entry) => entry.parts);
}
