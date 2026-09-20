import { getTranslations } from "next-intl/server";

import type { SubgroupRef } from "@/lib/api/group-detail";
import { countDescendants, subgroupTree, type SubgroupNode } from "@/lib/groups/subgroup-tree";

import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/status/badge";

/**
 * A group's descendants, nested, with every branch that has one folded away.
 *
 * **core-api hands over the whole subtree in one flat list**, so a department's page named every
 * course beneath it as if they were siblings -- the operator's own screen listed a container and
 * the course inside it side by side. The nesting is rebuilt here from each entry's
 * `parentGroupId`; the rule lives in `lib/groups/subgroup-tree.ts`, where it is tested.
 *
 * **`<details>`, not a React tree** (the same bargain as DEC-148's source files): the browser owns
 * the open state, gives it to a keyboard for free, and lets find-in-page reach inside a folded
 * branch. Nothing here is a client component, so a deep hierarchy costs no JavaScript at all.
 *
 * Open by default only at the first level. A reader who came to see what is inside this group is
 * looking for its children; a grandchild is something they go looking for, and a department with
 * thirty courses each holding several years is exactly the list this exists to keep readable.
 */
export async function SubgroupTree({
  rootId,
  subgroups,
}: {
  rootId: string;
  subgroups: SubgroupRef[];
}) {
  const t = await getTranslations("Group.info");
  const tree = subgroupTree(rootId, subgroups);

  return <Branch nodes={tree} depth={0} t={t} />;
}

type Translate = Awaited<ReturnType<typeof getTranslations<"Group.info">>>;

function Branch({
  nodes,
  depth,
  t,
}: {
  nodes: SubgroupNode<SubgroupRef>[];
  depth: number;
  t: Translate;
}) {
  return (
    <ul className={`flex flex-col gap-1 ${depth > 0 ? "border-l border-border pl-3" : ""}`}>
      {nodes.map((node) => (
        <li key={node.group.id}>
          {node.children.length === 0 ? (
            <GroupLink group={node.group} t={t} />
          ) : (
            <details open={depth === 0} className="group/branch">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 rounded-md py-0.5 marker:content-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                {/* The default marker renders differently in every browser and sits outside the
                    row; this one is in the flow and turns with the element's own `open`. */}
                <svg
                  className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/branch:rotate-90"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
                <GroupLink group={node.group} t={t} />
                <span className="text-xs text-muted-foreground">
                  {t("subgroupCount", { count: countDescendants(node) })}
                </span>
              </summary>
              <div className="mt-1 ml-1.5">
                <Branch nodes={node.children} depth={depth + 1} t={t} />
              </div>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

function GroupLink({ group, t }: { group: SubgroupRef; t: Translate }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Link
        href={`/groups/${group.id}`}
        className="text-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {group.name}
      </Link>
      {/* Why a container reads differently from a course: it holds no students and takes no
          assignments, which is the one thing worth knowing before clicking into it. */}
      {group.organizational && <Badge tone="neutral">{t("organizational")}</Badge>}
      {group.archived && <Badge tone="neutral">{t("archived")}</Badge>}
    </span>
  );
}
