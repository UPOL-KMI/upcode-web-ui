import { Link } from "@/i18n/navigation";

/**
 * Tab navigation for a page whose tabs are `?tab=` on its own address (D-001's `PageShell` slot).
 *
 * Extracted from `GroupTabs` when the exercise settings screen needed the same thing (T-033): the
 * markup, the active state and the "a tab is a link, not a button" rule were all worth having
 * once. The group's own component is now a thin wrapper, so its callers did not have to change.
 *
 * Tab state lives in the URL exactly as `docs/IA.md` §4.2 specifies, so the back button and a
 * shared link both land on the tab the reader was looking at.
 */
export interface PageTab {
  id: string;
  label: string;
  /**
   * How many things are behind the tab, when that is worth knowing before opening it -- comments,
   * submitted solutions. Omitted where the number would be noise, and **not rendered when it is
   * zero**: "Diskuze 0" is a worse way of saying "Diskuze".
   */
  count?: number;
  /**
   * A short string in the same pill, for a tab whose figure is not a plain count -- "2/3" passed
   * tests, say. **Rendered verbatim**, so a caller that has nothing to say must omit it rather
   * than pass an empty string; `count`'s "nothing when it is zero" rule cannot apply to text this
   * component does not understand. When both are given, this one wins.
   */
  badge?: string;
}

export function PageTabs({
  basePath,
  tabs,
  current,
  label,
  keepQuery,
}: {
  /** The page's own path, without the query -- e.g. `/exercises/<id>/edit`. */
  basePath: string;
  tabs: PageTab[];
  current: string;
  label: string;
  /** Query that has to survive switching tabs -- e.g. `grade=1`, so the grading bar stays (X-031). */
  keepQuery?: string;
}) {
  return (
    <nav aria-label={label} className="-mb-px flex flex-wrap gap-1">
      {tabs.map((tab) => {
        const active = tab.id === current;
        return (
          <Link
            key={tab.id}
            href={`${basePath}?tab=${tab.id}${keepQuery ? `&${keepQuery}` : ""}`}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {(tab.badge !== undefined || (tab.count !== undefined && tab.count > 0)) && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                {tab.badge ?? tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
