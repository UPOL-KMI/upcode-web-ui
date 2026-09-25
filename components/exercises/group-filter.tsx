"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Command } from "cmdk";
import { Popover } from "radix-ui";
import { useTranslations } from "next-intl";

import { fullPath, matchingGroups } from "@/lib/groups/group-search";
import { groupRows } from "@/lib/groups/tree-rows";

export interface GroupFilterOption {
  id: string;
  name: string;
  /** Ancestor names, outermost first -- `GroupListEntry.path`, already in tree order. */
  path: string[];
}

/**
 * The catalogue's group filter (X-022): type to narrow, and read the answer as a tree.
 *
 * **A `<select>` could not answer the question being asked of it.** Its options are a flat list of
 * "parent / name" strings, so a reader looking for `KMI/JP` had to recognise the course and its
 * seminar groups by name alone and could not see that one sits inside the other -- which is the
 * whole of the decision they are making, because filtering by the course returns what the seminar
 * group would return and more.
 *
 * So: a combobox whose matches keep their ancestors. `groupRows` is the same tree flattener the
 * assign offer uses (T-012), run over the matches rather than over everything, so every match
 * arrives with the containers it hangs under and the indentation means what it looks like it
 * means. A search matches against the **whole path**, not the name, which is why typing a course
 * code brings back the course and every group beneath it in one list.
 *
 * **Without JavaScript this is still the old `<select>`.** The screen is a plain GET form on
 * purpose -- every filter is a URL and a round trip -- and that property should not be spent on a
 * nicer picker. The native control is what renders on the server and what a reader without
 * scripting keeps; the combobox replaces it on mount (DEC-154).
 */
export function GroupFilter({
  name,
  value,
  groups,
}: {
  name: string;
  value: string | null;
  groups: GroupFilterOption[];
}) {
  const t = useTranslations("Exercises.filters");
  const enhanced = useSyncExternalStore(subscribeToNothing, onClient, onServer);
  const [selected, setSelected] = useState(value ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => groupRows(matchingGroups(groups, query)), [groups, query]);

  const matchCount = rows.reduce((count, row) => (row.kind === "group" ? count + 1 : count), 0);
  const chosen = groups.find((group) => group.id === selected);

  if (!enhanced) {
    return (
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t("group")}
        <select
          name={name}
          defaultValue={value ?? ""}
          title={t("groupExplain")}
          className="max-w-72 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{t("anyGroup")}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id} title={fullPath(group)}>
              {shortLabel(group)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const choose = (id: string) => {
    setSelected(id);
    setQuery("");
    setOpen(false);
  };

  const searching = query.trim() !== "";
  const clearFilter = (
    <Command.Item
      value="any-group"
      onSelect={() => choose("")}
      className="cursor-pointer rounded-md px-2 py-1.5 text-sm text-foreground data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      {t("anyGroup")}
    </Command.Item>
  );

  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span id={`${name}-filter-label`}>{t("group")}</span>
      <input type="hidden" name={name} value={selected} />

      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <Popover.Trigger
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-labelledby={`${name}-filter-label`}
          title={chosen ? fullPath(chosen) : t("groupExplain")}
          className="flex max-w-72 min-w-56 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-left text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          <span className="truncate">{chosen ? shortLabel(chosen) : t("anyGroup")}</span>
          <span aria-hidden="true" className="text-muted-foreground">
            ▾
          </span>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 w-(--radix-popover-trigger-width) min-w-80 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
          >
            <Command shouldFilter={false} label={t("group")}>
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t("groupSearchPlaceholder")}
                className="w-full border-b border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none"
              />
              <Command.List label={t("group")} className="max-h-72 overflow-y-auto p-1">
                {/* cmdk highlights the first option, and Enter takes it. So while a query is being
                    typed this one goes last: the reader is reaching for a match, and clearing the
                    filter is the last thing they mean by pressing Enter. */}
                {searching || clearFilter}

                {matchCount === 0 && (
                  <p className="px-2 py-3 text-sm text-muted-foreground">{t("groupNoMatch")}</p>
                )}

                {rows.map((row) =>
                  row.kind === "heading" ? (
                    // Decoration for the eye only: a listbox may hold nothing but options, and the
                    // chain it draws is on each option's own accessible name instead.
                    <div
                      key={row.key}
                      aria-hidden="true"
                      style={{ paddingLeft: indent(row.depth) }}
                      className="truncate py-1 pr-2 text-xs text-muted-foreground"
                    >
                      {row.name}
                    </div>
                  ) : (
                    <Command.Item
                      key={row.key}
                      value={row.key}
                      onSelect={() => choose(row.id)}
                      aria-label={labelOf(groups, row.id)}
                      style={{ paddingLeft: indent(row.depth) }}
                      className={`cursor-pointer truncate rounded-md py-1.5 pr-2 text-sm text-foreground data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground ${
                        row.id === selected ? "font-semibold" : ""
                      }`}
                    >
                      {row.name}
                    </Command.Item>
                  ),
                )}

                {searching && clearFilter}
              </Command.List>
            </Command>
            {/* Outside the listbox, for the same reason the headings are hidden from it. */}
            <span role="status" className="sr-only">
              {query.trim() === "" ? "" : t("groupMatchCount", { count: matchCount })}
            </span>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

/** Whether scripting is actually running: `false` through the server render and the hydration that
 *  must match it, `true` from the first client render onwards. A store rather than an effect --
 *  `useSyncExternalStore` is the hook React provides for a value that differs between the two, and
 *  the effect it replaces was a synchronous `setState` in an effect body. */
const subscribeToNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** What fits on the closed control: the immediate parent and the name, as `group-info.tsx` shows. */
function shortLabel(group: GroupFilterOption): string {
  const parent = group.path[group.path.length - 1];
  return parent ? `${parent} / ${group.name}` : group.name;
}

function labelOf(groups: GroupFilterOption[], id: string): string {
  const group = groups.find((candidate) => candidate.id === id);
  return group ? fullPath(group) : "";
}

const indent = (depth: number) => `${0.5 + depth * 0.875}rem`;
