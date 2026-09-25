/**
 * A hierarchically ordered list of groups, turned into rows with each container above its first
 * child (T-012's assign offer, and anywhere else a flat list has to read as a tree).
 *
 * Its own module rather than a helper inside the form: it is pure, it is the part with an edge
 * worth testing -- a second branch must get its own headings rather than inheriting the previous
 * one's -- and a test for it should not have to mount a client component to reach it.
 */

type GroupRow =
  | { kind: "heading"; key: string; depth: number; name: string }
  | { kind: "group"; key: string; depth: number; name: string; id: string };

/**
 * Turns a hierarchically ordered list of selectable groups into rows, inserting each container
 * above its first child.
 *
 * A heading is emitted the first time a level of the path differs from the one already shown --
 * and showing it invalidates everything deeper, so a sibling branch gets its own headings rather
 * than inheriting the previous branch's. Headings are text, not checkboxes: they are the groups
 * that cannot take an assignment, which is why they are not in the offer in the first place.
 *
 * A group that is itself somebody's container counts as shown at its own depth, so it is not
 * printed twice -- once as a row and again as the heading above its children. The assign offer
 * never hit that because a container there cannot take an assignment and is therefore absent from
 * the list; X-022's filter offers both.
 */
export function groupRows(groups: { id: string; name: string; path: string[] }[]): GroupRow[] {
  const rows: GroupRow[] = [];
  let shown: string[] = [];

  for (const group of groups) {
    group.path.forEach((name, depth) => {
      if (shown[depth] === name) return;
      rows.push({
        kind: "heading",
        key: `heading:${group.path.slice(0, depth + 1).join("/")}`,
        depth,
        name,
      });
      shown = group.path.slice(0, depth + 1);
    });
    shown = [...group.path, group.name];
    rows.push({
      kind: "group",
      key: group.id,
      depth: group.path.length,
      name: group.name,
      id: group.id,
    });
  }

  return rows;
}
