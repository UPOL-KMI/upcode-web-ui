import { describe, expect, it } from "vitest";

import { countDescendants, subgroupTree } from "./subgroup-tree";

const g = (id: string, parentGroupId: string | null) => ({ id, parentGroupId });

const shape = (
  nodes: ReturnType<typeof subgroupTree<{ id: string; parentGroupId: string | null }>>,
): string =>
  nodes
    .map((node) =>
      node.children.length === 0 ? node.group.id : `${node.group.id}(${shape(node.children)})`,
    )
    .join(",");

describe("subgroupTree", () => {
  it("nests the operator's own case: a container and the course inside it", () => {
    const tree = subgroupTree("root", [g("kmi-jp", "root"), g("2025-26", "kmi-jp")]);
    expect(shape(tree)).toBe("kmi-jp(2025-26)");
  });

  it("keeps two branches apart", () => {
    const tree = subgroupTree("root", [
      g("a", "root"),
      g("a1", "a"),
      g("b", "root"),
      g("b1", "b"),
      g("b2", "b"),
    ]);
    expect(shape(tree)).toBe("a(a1),b(b1,b2)");
  });

  it("nests three levels deep", () => {
    const tree = subgroupTree("root", [g("a", "root"), g("b", "a"), g("c", "b")]);
    expect(shape(tree)).toBe("a(b(c))");
  });

  it("surfaces a group whose parent the reader cannot see, rather than dropping it", () => {
    // core-api filters the subtree by visibility, so the middle group can be absent.
    const tree = subgroupTree("root", [g("grandchild", "hidden-middle")]);
    expect(shape(tree)).toBe("grandchild");
  });

  it("treats a parentless group as a top-level one", () => {
    expect(shape(subgroupTree("root", [g("a", null)]))).toBe("a");
  });

  it("has nothing to say about an empty list", () => {
    expect(subgroupTree("root", [])).toEqual([]);
  });

  it("does not loop on a group that claims itself as its parent", () => {
    expect(shape(subgroupTree("root", [g("a", "a")]))).toBe("a");
  });

  it("surfaces a pair caught in a cycle rather than losing both", () => {
    const tree = subgroupTree("root", [g("a", "b"), g("b", "a")]);
    expect(tree.map((node) => node.group.id).sort()).toEqual(["a", "b"]);
  });
});

describe("countDescendants", () => {
  it("counts every level, not just the children", () => {
    const [node] = subgroupTree("root", [g("a", "root"), g("b", "a"), g("c", "b"), g("d", "a")]);
    expect(countDescendants(node!)).toBe(3);
  });

  it("is nought for a leaf", () => {
    const [node] = subgroupTree("root", [g("a", "root")]);
    expect(countDescendants(node!)).toBe(0);
  });
});
