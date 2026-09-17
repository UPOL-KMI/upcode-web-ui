import { visit } from "unist-util-visit";
import type { Element, Root } from "hast";
import type { Plugin } from "unified";

/**
 * GitHub-style alerts: a blockquote whose first line is `[!WARNING]` becomes a coloured box.
 *
 * ```markdown
 * > [!WARNING]
 * > **Beta.** The wording of this page will still change.
 * ```
 *
 * Written here rather than pulled from a package because it is twenty lines and one CSS rule, and
 * because the syntax has to behave the same in a guide and in an exercise text -- both render
 * through the one `Markdown` component, so both get this.
 *
 * **The box carries no label of its own.** GitHub prints "Warning" above the text; that word would
 * have to come from the message catalogue, which a plugin operating on authored markdown has no
 * business reaching into -- and an English word above a Czech paragraph is worse than none. The
 * author writes their own lead instead, which is also the only way a translated document can say
 * it in its own language.
 *
 * An unknown marker (`[!SOMETHING]`) is left exactly as written, visible, rather than silently
 * swallowed: an author who mistypes a marker needs to see that they did.
 */
const KINDS = new Set(["note", "tip", "warning", "caution", "important"]);

export const rehypeAlerts: Plugin<[], Root> = () => (tree) => {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "blockquote") return;

    const paragraph = node.children.find(
      (child): child is Element => child.type === "element" && child.tagName === "p",
    );
    const first = paragraph?.children[0];
    if (!first || first.type !== "text") return;

    const match = /^\[!([A-Za-z]+)\]\s*\n?/.exec(first.value);
    const kind = match?.[1]?.toLowerCase();
    if (!match || !kind || !KINDS.has(kind)) return;

    first.value = first.value.slice(match[0].length);
    // A marker on a line of its own leaves an empty first paragraph behind, and an empty <p> is a
    // blank line the reader cannot account for.
    if (first.value === "" && paragraph!.children.length === 1) {
      node.children = node.children.filter((child) => child !== paragraph);
    }

    node.properties = { ...node.properties, "data-alert": kind };
  });
};
