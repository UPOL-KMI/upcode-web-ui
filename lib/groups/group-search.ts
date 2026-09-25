/**
 * Narrowing a list of groups by what somebody typed (X-022).
 *
 * Its own module rather than a helper inside the filter: the rule it encodes is the whole of what
 * makes the filter useful, and it has an edge worth testing -- a query is matched against the
 * **full path**, so a course code brings back the course and everything beneath it, which is what
 * lets `groupRows` draw the relationship between them.
 */

export interface SearchableGroup {
  name: string;
  /** Ancestor names, outermost first. */
  path: string[];
}

/** The whole chain, as it is shown and as it is searched. */
export function fullPath(group: SearchableGroup): string {
  return [...group.path, group.name].join(" / ");
}

/**
 * Case- and diacritic-insensitive, because nobody types `Úterý` into a filter and a Czech keyboard
 * is not a given on a lab machine. Punctuation is deliberately **kept**: course codes are written
 * `KMI/JP`, and stripping the slash would make that query match every group whose path happens to
 * contain the letters in order.
 */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * The groups a query names, in the order they arrived.
 *
 * Matching the full path rather than the name is the point: a reader looking for `KMI/JP` gets the
 * course **and** its seminar groups, because the course's name is part of every child's path. That
 * is the comparison they are actually making -- filtering by the course returns what any of its
 * seminar groups would return and more -- and it is only visible when both are on screen at once.
 */
export function matchingGroups<T extends SearchableGroup>(groups: T[], query: string): T[] {
  const needle = fold(query.trim());
  if (needle === "") return groups;
  return groups.filter((group) => fold(fullPath(group)).includes(needle));
}
