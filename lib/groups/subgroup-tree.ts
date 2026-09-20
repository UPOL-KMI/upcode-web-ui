/**
 * The flat list of descendants core-api returns, nested back into a tree.
 *
 * **`GET /v1/groups/{id}/subgroups` is the whole subtree, not the children.** It is
 * `Group::getAllSubgroups()` filtered by what the reader may see (`GroupsPresenter::actionSubgroups`),
 * so a department's page listed every course under it in one flat column -- the operator's own
 * screen named a container and the course inside it as if they were siblings. Each entry carries
 * its `parentGroupId`, which is all that is needed to put them back.
 *
 * **A node whose parent is not in the list is treated as a child of the root.** That is not
 * defensive coding for its own sake: the filter above drops groups the reader may not see, so a
 * visible grandchild of an invisible child is a real shape, and dropping it would hide a group the
 * reader is allowed to know about. It surfaces one level up instead.
 *
 * Order is preserved from the input, which core-api returns in its own traversal order; siblings
 * are sorted by name at the call site, where a locale is available.
 */
export interface SubgroupNode<T> {
  group: T;
  children: SubgroupNode<T>[];
}

export function subgroupTree<T extends { id: string; parentGroupId: string | null }>(
  rootId: string,
  groups: T[],
): SubgroupNode<T>[] {
  const nodes = new Map<string, SubgroupNode<T>>(
    groups.map((group) => [group.id, { group, children: [] }]),
  );

  const roots: SubgroupNode<T>[] = [];
  for (const group of groups) {
    const node = nodes.get(group.id)!;
    const parent = group.parentGroupId === null ? undefined : nodes.get(group.parentGroupId);
    // The parent is the page's own group, or a group the reader cannot see, or missing entirely --
    // all three mean "hang it at the top" rather than "drop it".
    if (parent && parent !== node && group.parentGroupId !== rootId) parent.children.push(node);
    else roots.push(node);
  }

  // **Nothing may go missing.** A tree cannot contain a cycle and core-api builds one, but this
  // reads ids off a payload, and a group caught in a cycle would hang off a parent that hangs off
  // it -- present in the structure and reachable from no root, so it would silently vanish from a
  // screen whose whole job is to list what is there. Anything the walk below does not reach is
  // surfaced at the top instead.
  const reached = new Set<string>();
  const walk = (list: SubgroupNode<T>[]) => {
    for (const node of list) {
      if (reached.has(node.group.id)) continue;
      reached.add(node.group.id);
      walk(node.children);
    }
  };
  walk(roots);
  for (const group of groups) {
    if (!reached.has(group.id)) roots.push(nodes.get(group.id)!);
  }
  return roots;
}

/** How many groups a node holds below it, for a summary beside a folded branch. */
export function countDescendants<T>(node: SubgroupNode<T>): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}
