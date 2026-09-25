import "server-only";

import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import { apiPost } from "./client";
import { apiRead } from "./read";

/**
 * The exercise catalog: the list every teacher starts from (T-020), and the narrower read the
 * "assign one to this group" picker makes of it (T-001).
 *
 * `/v1/exercises` answers a **paginated envelope** (`{items, totalCount, offset, limit, ...}`),
 * unlike `/v1/groups`, which is a bare array -- the same inconsistency `app/api/search/route.ts`
 * already had to normalise.
 *
 * **Its filters live under a `filters` parameter, not at the top level, and getting that wrong
 * fails silently.** `?search=` is simply ignored -- core-api reads `filters[search]`, and an
 * unknown query parameter is not an error -- so T-001's picker shipped with a search box that
 * answered with the first twenty-five exercises whatever was typed into it, and a "matched" count
 * that was the size of the whole catalog. Found while building T-020 against the same endpoint,
 * by reading `ExercisesPresenter::actionDefault`'s own whitelist; confirmed live
 * (`filters[search]=zzz` answers `totalCount: 0`, `search=zzz` answers the lot).
 *
 * This is the one list in this app that is **not** fetched whole (Q-015's trade, inverted): the
 * endpoint is genuinely paginated and an instance can hold thousands, so the query -- search,
 * filters, ordering and page -- goes to core-api and the reader is told how many matched.
 */
export interface ExerciseListItem {
  id: string;
  name: string;
  difficulty: string;
  environments: string[];
  tags: string[];
  authorId: string;
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
  isLocked: boolean;
  isBroken: boolean;
  archived: boolean;
  hasReferenceSolutions: boolean;
  /**
   * The groups the exercise is **attached to**, which is not the same as the groups it can be
   * assigned in: core-api expands a group into its ancestral closure when filtering, so an
   * exercise attached to a course is assignable in every lab beneath it (X-016). These are the
   * attachments; the filter answers the wider question.
   */
  groupIds: string[];
  can: Record<string, boolean>;
}

interface ExercisePayload {
  id: string;
  localizedTexts?: LocalizedText[];
  difficulty: string;
  runtimeEnvironments?: { id: string }[];
  tags?: string[];
  authorId: string;
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
  isLocked: boolean;
  isBroken: boolean;
  archivedAt: number | null;
  hasReferenceSolutions: boolean;
  /** On the wire since forever (`ExerciseViewFactory.php:60`); this type simply never declared it. */
  groupsIds?: string[];
  permissionHints?: Record<string, boolean>;
}

interface ExerciseEnvelope {
  items: ExercisePayload[];
  totalCount: number;
}

/** core-api's own three (its `archived` filter): what is live, everything, or only what is retired. */
export type ArchivedScope = "default" | "all" | "only";

export interface ExerciseQuery {
  search: string;
  archived: ArchivedScope;
  environments: string[];
  tags: string[];
  /** One author, or none. core-api accepts several; the catalog offers one, as the legacy app does. */
  authors: string[];
  /**
   * One group, or none (X-016).
   *
   * **This is "assignable in", not "attached to".** `filters[groupsIds][]` is expanded through
   * `groupsIdsAncestralClosure` before matching, so filtering by a lab returns what its course and
   * its faculty hold as well -- which is the question a teacher is actually asking, and the same
   * behaviour the assign screen's picker already relies on (`getAssignableExercises`).
   */
  group: string | null;
  /** Zero-based. */
  page: number;
}

export interface ExerciseCatalogPage {
  items: ExerciseListItem[];
  /** How many the query matched in total, which need not be how many are listed. */
  totalCount: number;
  page: number;
  pageSize: number;
  /** The authors of the rows on this page, by id -- one batched lookup, not one per row. */
  authors: Map<string, string>;
}

export const CATALOG_PAGE_SIZE = 20;
const PICKER_PAGE_SIZE = 25;

function listItem(exercise: ExercisePayload, locale: string): ExerciseListItem {
  return {
    id: exercise.id,
    name: localizedName(exercise.localizedTexts, locale),
    difficulty: exercise.difficulty,
    environments: (exercise.runtimeEnvironments ?? []).map((environment) => environment.id),
    tags: [...(exercise.tags ?? [])].sort(),
    authorId: exercise.authorId,
    createdAt: exercise.createdAt,
    updatedAt: exercise.updatedAt,
    isPublic: exercise.isPublic,
    isLocked: exercise.isLocked,
    isBroken: exercise.isBroken,
    archived: exercise.archivedAt !== null,
    hasReferenceSolutions: exercise.hasReferenceSolutions,
    groupIds: exercise.groupsIds ?? [],
    can: exercise.permissionHints ?? {},
  };
}

/**
 * One page of the catalog, ordered by name **in the reader's own locale** -- core-api takes
 * `orderBy` together with the `locale` it should collate by, so this is a real ordering of the
 * whole result rather than a sorted page of twenty.
 */
export async function getExerciseCatalog(
  query: ExerciseQuery,
  locale: string,
): Promise<ExerciseCatalogPage> {
  const envelope = await apiRead<ExerciseEnvelope>("/v1/exercises", {
    query: {
      limit: CATALOG_PAGE_SIZE,
      offset: query.page * CATALOG_PAGE_SIZE,
      orderBy: "name",
      locale,
      ...(query.search !== "" && { "filters[search]": query.search }),
      ...(query.archived !== "default" && { "filters[archived]": query.archived }),
      ...(query.environments.length > 0 && { "filters[runtimeEnvironments]": query.environments }),
      ...(query.tags.length > 0 && { "filters[tags]": query.tags }),
      ...(query.authors.length > 0 && { "filters[authorsIds]": query.authors }),
      // An array, so the client appends the `[]` core-api expects rather than this spelling it.
      ...(query.group !== null && { "filters[groupsIds]": [query.group] }),
    },
  });

  const items = envelope.items.map((exercise) => listItem(exercise, locale));
  const authorIds = [...new Set(items.map((item) => item.authorId))];
  const people =
    authorIds.length > 0
      ? await apiPost<{ id: string; fullName: string }[]>("/v1/users/list", { ids: authorIds })
      : [];

  return {
    items,
    totalCount: envelope.totalCount,
    page: query.page,
    pageSize: CATALOG_PAGE_SIZE,
    authors: new Map(people.map((person) => [person.id, person.fullName])),
  };
}

/**
 * Everybody who has written an exercise this reader may see, for the catalog's own filter (G-018).
 *
 * A separate endpoint rather than a distinct-over-the-page: the catalog is paginated, so the
 * authors of *this page* are not the authors of the catalog, and a filter offering only the names
 * that happen to be on screen would be a filter that changes as you page through it.
 */
export async function getExerciseAuthors(): Promise<{ id: string; name: string }[]> {
  const authors =
    await apiRead<{ id: string; fullName?: string; name?: unknown }[]>("/v1/exercises/authors");
  return authors
    .map((author) => ({ id: author.id, name: author.fullName ?? "" }))
    .filter((author) => author.name !== "")
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every tag anybody has put on an exercise, for the catalog's own filter. */
export async function getExerciseTags(): Promise<string[]> {
  const tags = await apiRead<string[]>("/v1/exercises/tags");
  return [...tags].sort();
}

/**
 * The picker's read (T-001): the same catalog, seen through what may be assigned.
 *
 * `canAssign` is core-api's own hint. **All five preconditions on assigning are visible here** --
 * the hint, `isLocked`, `isBroken`, and, contrary to what DEC-093 recorded, `hasReferenceSolutions`
 * as well: it is in the list payload after all. That correction is why the picker no longer waits
 * for core-api to refuse an exercise that has no reference solution.
 */
export interface AssignableExercise {
  id: string;
  name: string;
  difficulty: string;
  environments: string[];
  isLocked: boolean;
  isBroken: boolean;
  hasReferenceSolutions: boolean;
  canAssign: boolean;
  /** core-api's own hint, so the link to the configuration is offered only where it would open. */
  canViewConfig: boolean;
}

export interface AssignableExercises {
  exercises: AssignableExercise[];
  totalCount: number;
}

/**
 * The exercises a group may be given (T-001), narrowed to the group's own pool where asked (G-010).
 *
 * **`filters[groupsIds][]` is not "attached to this group"; it is the group's *ancestral closure*.**
 * core-api's `getPreparedForPaginationGroupsFilter` expands the id through
 * `groupsIdsAncestralClosure` before matching, so a lab inherits whatever its course holds and a
 * course whatever its faculty does -- read from the repository, then confirmed against the seed,
 * where `Intro to Programming / Lab A` has no exercises of its own and answers with its parent's
 * 28. That is the behaviour a teacher wants and would be surprising to reimplement as a plain
 * membership test.
 */
export async function getAssignableExercises(
  locale: string,
  search: string,
  groupId: string | null,
): Promise<AssignableExercises> {
  const envelope = await apiRead<ExerciseEnvelope>("/v1/exercises", {
    query: {
      limit: PICKER_PAGE_SIZE,
      offset: 0,
      orderBy: "name",
      locale,
      ...(search !== "" && { "filters[search]": search }),
      // An array, so the client appends the `[]` core-api expects rather than this spelling it.
      ...(groupId !== null && { "filters[groupsIds]": [groupId] }),
    },
  });

  return {
    totalCount: envelope.totalCount,
    exercises: envelope.items.map((exercise) => {
      const row = listItem(exercise, locale);
      return {
        id: row.id,
        name: row.name,
        difficulty: row.difficulty,
        environments: row.environments,
        isLocked: row.isLocked,
        isBroken: row.isBroken,
        hasReferenceSolutions: row.hasReferenceSolutions,
        canAssign: row.can.assign === true,
        canViewConfig: row.can.viewConfig === true,
      };
    }),
  };
}
