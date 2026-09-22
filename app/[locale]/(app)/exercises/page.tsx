import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import {
  CATALOG_PAGE_SIZE,
  getExerciseAuthors,
  getExerciseCatalog,
  getExerciseTags,
  type ArchivedScope,
} from "@/lib/api/exercises";
import { getCurrentUser } from "@/lib/api/current-user";
import { getGroupList, getMyGroups } from "@/lib/api/groups";
import { getRuntimeEnvironments } from "@/lib/api/runtime-environments";
import { resolveBreadcrumbsForNamespace } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { CreateExercise } from "@/components/exercises/create-exercise";
import { ExerciseTable } from "@/components/exercises/exercise-table";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";
import { buttonClasses } from "@/components/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Exercises" });
  return { title: t("title") };
}

/**
 * The exercise catalog (T-020) -- the legacy `/app/exercises` page, and the screen the sidebar has
 * been linking to since D-014.
 *
 * **Everything that narrows this list is a URL and a round trip.** The endpoint is genuinely
 * paginated, an instance can hold thousands of exercises, and core-api does the searching,
 * filtering, ordering and slicing itself -- so the form below is a plain `GET` form and the pager
 * is two links. No JavaScript is needed to use this screen, and a narrowed view is an address
 * somebody can send to a colleague.
 *
 * Who sees it at all is `canViewAll` on the exercise ACL, which core-api checks; `apiRead` turns
 * its refusal into the refusal page. Each row is then core-api's own answer again -- the list
 * contains only exercises this reader may view, and the name links only where `viewDetail` says so.
 *
 * Creating one is **not here**: `POST /exercises` makes an empty, broken exercise that is useless
 * until its texts and configuration exist, so it belongs with the screen that edits them (T-008),
 * the same way assigning belongs with T-002's settings (DEC-093).
 */
const ARCHIVED_SCOPES: ArchivedScope[] = ["default", "all", "only"];

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    archived?: string;
    env?: string;
    tag?: string;
    author?: string;
    group?: string;
    page?: string;
  }>;
}) {
  const [query, locale] = await Promise.all([searchParams, getLocale()]);

  const search = (query.q ?? "").trim();
  const archived = ARCHIVED_SCOPES.find((scope) => scope === query.archived) ?? "default";
  const environments = query.env ? [query.env] : [];
  const tags = query.tag ? [query.tag] : [];
  const authors = query.author ? [query.author] : [];
  const group = query.group || null;
  const page = Math.max(0, Number(query.page ?? "0") || 0);

  const [
    t,
    tImport,
    catalog,
    allEnvironments,
    allTags,
    allAuthors,
    viewer,
    mine,
    allGroups,
    breadcrumbs,
  ] = await Promise.all([
    getTranslations("Exercises"),
    getTranslations("ExerciseImport"),
    getExerciseCatalog({ search, archived, environments, tags, authors, group, page }, locale),
    getRuntimeEnvironments(),
    getExerciseTags(),
    getExerciseAuthors(),
    getCurrentUser(),
    // Where a new exercise could go: core-api's `createExercise` wants a group the reader
    // supervises or administers, which is exactly this list (T-008).
    getMyGroups(locale),
    // Every group this reader can see: the names the Group column prints, and -- narrowed to the
    // ones they teach -- the filter's own options (X-016). Built on the same memoized fetch the
    // line above uses, so it is not a second round trip.
    getGroupList(locale),
    resolveBreadcrumbsForNamespace("Exercises", locale),
  ]);

  /**
   * Names for the Group column, and the paths that disambiguate them.
   *
   * **A group the reader cannot see is simply absent**, and the column then prints nothing for it
   * rather than a raw id -- the same choice `GroupListEntry.path` already makes for an invisible
   * ancestor. An exercise whose every group is invisible looks unattached, which is the honest
   * rendering of what this reader is allowed to know.
   */
  const groupNames = new Map(
    allGroups.map((entry) => [entry.id, { name: entry.name, path: entry.path }]),
  );
  // The filter offers what the reader may act on -- inherited administration included (DEC-150),
  // which is what `membership: "teacher"` already means on this list.
  const teachableGroups = allGroups.filter((entry) => entry.membership === "teacher");

  // Whether anything is narrowing the list, which decides what "nothing here" means: an empty
  // catalog and a filter that matched nothing are different sentences.
  const narrowed =
    search !== "" ||
    archived !== "default" ||
    environments.length > 0 ||
    tags.length > 0 ||
    authors.length > 0 ||
    group !== null;
  const lastPage = Math.max(0, Math.ceil(catalog.totalCount / CATALOG_PAGE_SIZE) - 1);

  /** The same view with one filter swapped, keeping the rest and dropping the page. */
  const filterHref = (change: { author: string | null }) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (archived !== "default") params.set("archived", archived);
    if (environments[0]) params.set("env", environments[0]);
    if (tags[0]) params.set("tag", tags[0]);
    if (group) params.set("group", group);
    if (change.author !== null) params.set("author", change.author);
    const serialized = params.toString();
    return serialized ? `/exercises?${serialized}` : "/exercises";
  };

  // Offered only to somebody who has actually written one: to everybody else it is a link to an
  // empty list, which is a worse answer than no link.
  const viewerWritesExercises = allAuthors.some((author) => author.id === viewer.id);
  const mineHref = !viewerWritesExercises
    ? null
    : authors[0] === viewer.id
      ? filterHref({ author: null })
      : filterHref({ author: viewer.id });

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (archived !== "default") params.set("archived", archived);
    if (environments[0]) params.set("env", environments[0]);
    if (tags[0]) params.set("tag", tags[0]);
    if (authors[0]) params.set("author", authors[0]);
    if (group) params.set("group", group);
    if (target > 0) params.set("page", String(target));
    const serialized = params.toString();
    return serialized ? `/exercises?${serialized}` : "/exercises";
  };

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")} breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-4">
        <CreateExercise groups={mine.teaching} />

        {/* Offered beside "new exercise" because it is the other way to get one, and only to
            somebody who could create one at all -- the import screen's own check is the same
            (X-001). */}
        {mine.teaching.length > 0 && (
          <Link
            href="/exercises/import"
            className="self-start text-sm underline hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {tImport("title")}
          </Link>
        )}

        {/* A plain GET form: the filters are the server's business, and the URL they produce is
            the shareable view (brief §9). The page resets to the first whenever they change,
            which is why it is not carried in a hidden field. */}
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("filters.search")}
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder={t("filters.searchPlaceholder")}
              className="min-w-56 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("filters.environment")}
            <select
              name="env"
              defaultValue={environments[0] ?? ""}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{t("filters.anyEnvironment")}</option>
              {allEnvironments.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.name}
                </option>
              ))}
            </select>
          </label>

          {allTags.length > 0 && (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("filters.tag")}
              <select
                name="tag"
                defaultValue={tags[0] ?? ""}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t("filters.anyTag")}</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
          )}

          {allAuthors.length > 0 && (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("filters.author")}
              <select
                name="author"
                defaultValue={authors[0] ?? ""}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t("filters.anyAuthor")}</option>
                {allAuthors.map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {teachableGroups.length > 0 && (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("filters.group")}
              <select
                name="group"
                defaultValue={group ?? ""}
                title={t("filters.groupExplain")}
                className="max-w-72 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t("filters.anyGroup")}</option>
                {/* The immediate parent and the name, which is what `group-info.tsx` shows and
                    what a `<select>` can hold; the whole chain from the instance root is a
                    hundred characters and would be truncated to uselessness. The full path is
                    on the option's own title for anybody who needs it. */}
                {teachableGroups.map((entry) => {
                  const parent = entry.path[entry.path.length - 1];
                  return (
                    <option
                      key={entry.id}
                      value={entry.id}
                      title={[...entry.path, entry.name].join(" / ")}
                    >
                      {parent ? `${parent} / ${entry.name}` : entry.name}
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("filters.archived")}
            <select
              name="archived"
              defaultValue={archived}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              {ARCHIVED_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {t(`filters.archivedScopes.${scope}`)}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className={buttonClasses("outline", "sm")}>
            {t("filters.apply")}
          </button>

          {/* The legacy app's one click, and the query an author actually makes. A link rather
              than a third state of the select: it is not a filter to combine but a destination,
              and it clears the page so the reader lands on the first of their own. */}
          {mineHref !== null && (
            <Link href={mineHref} className={buttonClasses("outline", "sm")}>
              {authors[0] === viewer.id ? t("filters.everyone") : t("filters.mine")}
            </Link>
          )}
        </form>

        {catalog.items.length === 0 ? (
          <EmptyState
            title={t("empty.title")}
            description={narrowed ? t("empty.noMatch") : t("empty.description")}
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("summary", {
                from: page * CATALOG_PAGE_SIZE + 1,
                to: page * CATALOG_PAGE_SIZE + catalog.items.length,
                total: catalog.totalCount,
              })}
            </p>

            {/* The closure is correct and surprising: filter by one lab and rows appear whose
                Group column names the course above it, because that is where they are stored and
                the lab can assign them all the same. Said once, above the table. */}
            {group !== null && (
              <p className="text-sm text-muted-foreground">{t("filters.groupExplain")}</p>
            )}

            <ExerciseTable page={catalog} groups={groupNames} />

            {lastPage > 0 && (
              <nav aria-label={t("pagination.label")} className="flex items-center gap-3 text-sm">
                {page > 0 ? (
                  <Link href={pageHref(page - 1)} className={buttonClasses("outline", "sm")}>
                    {t("pagination.previous")}
                  </Link>
                ) : (
                  <span className="rounded-md border border-input px-2 py-1 text-muted-foreground opacity-50">
                    {t("pagination.previous")}
                  </span>
                )}
                <span className="text-muted-foreground">
                  {t("pagination.page", { page: page + 1, total: lastPage + 1 })}
                </span>
                {page < lastPage ? (
                  <Link href={pageHref(page + 1)} className={buttonClasses("outline", "sm")}>
                    {t("pagination.next")}
                  </Link>
                ) : (
                  <span className="rounded-md border border-input px-2 py-1 text-muted-foreground opacity-50">
                    {t("pagination.next")}
                  </span>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
