import "server-only";

import { cache } from "react";

import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import { ApiError, apiGet, apiPost } from "./client";
import { getExerciseFiles, linkMap, type ExerciseFileLink } from "./exercise-files";
import { getGroupList } from "./groups";
import { pageRead } from "./read";
import { replaceLinkKeys } from "@/lib/i18n-text/file-links";

/**
 * One exercise, read rather than edited (T-021).
 *
 * The screen the catalog leads to and the one T-008's editor will return to. It answers the
 * questions a teacher has before assigning: what is it, in what languages, who wrote it, is it
 * finished -- and, when it is not, **why not**. `validationError` is core-api's own list of what
 * is missing (`@no-tests`, `@no-runtimes`, ...) and is the difference between "broken" as a red
 * badge and "broken" as something somebody can act on.
 *
 * Three things this deliberately does not show, because the screens that own them do not exist
 * yet and a link to a route that is not there is worse than none (DEC-066): the reference
 * solutions themselves (T-011), the assignments made from this exercise (T-012 -- their *count*
 * is here, which is what tells you the exercise is in use), and the tests and limits (T-009,
 * T-010). Nothing here writes; every control that changes an exercise belongs to T-008.
 */
export interface ExerciseText {
  locale: string;
  name: string;
  text: string;
  /** The short description, which core-api discloses only to whoever may see the exercise. */
  description: string;
  link: string;
}

export interface ExerciseFile {
  id: string;
  name: string;
  size: number;
}

export interface ExerciseDetail {
  id: string;
  name: string;
  version: number;
  difficulty: string;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
  /** Every locale core-api holds for this exercise, with `%%key%%` placeholders resolved. */
  texts: ExerciseText[];
  /** The same texts exactly as stored -- what the settings form edits, placeholders and all. */
  rawTexts: ExerciseText[];
  /** The reader's own locale, falling back to whatever exists (`localizedName`'s rule). */
  text: ExerciseText | null;
  environments: { id: string; name: string }[];
  tags: string[];
  author: { id: string; name: string };
  admins: { id: string; name: string }[];
  /** The groups this exercise belongs to, named where the reader may see them. */
  groups: { id: string; name: string }[];
  /** How many of `groupsIds` core-api did not disclose to this reader. */
  undisclosedGroups: number;
  isPublic: boolean;
  isLocked: boolean;
  isBroken: boolean;
  /** `simpleExerciseConfig` or `advancedExerciseConfig` -- which editor T-009's screen offers. */
  configurationType: string;
  /** core-api's `@key`-prefixed reasons, split apart. Empty when the exercise is fine. */
  validationErrors: string[];
  hasReferenceSolutions: boolean;
  forkedFrom: string | null;
  solutionFilesLimit: number | null;
  solutionSizeLimit: number | null;
  /** Whether the judge's stderr is folded into its stdout -- a setting only T-008's form reads,
   *  carried here so that saving the form cannot silently flip it. */
  mergeJudgeLogs: boolean;
  files: ExerciseFile[];
  /** The named links into those files, whose keys the texts above have already been resolved
   *  against (T-023). */
  fileLinks: ExerciseFileLink[];
  /** Assignments made from this exercise **that this reader may see** -- core-api filters them. */
  assignmentCount: number;
  can: Record<string, boolean>;
}

interface ExerciseDetailPayload {
  id: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
  localizedTexts?: (LocalizedText & { text?: string; description?: string; link?: string })[];
  difficulty: string;
  runtimeEnvironments?: { id: string; name: string }[];
  tags?: string[];
  authorId: string;
  adminsIds?: string[];
  groupsIds?: string[];
  isPublic: boolean;
  isLocked: boolean;
  isBroken: boolean;
  configurationType?: string;
  validationError: string | null;
  hasReferenceSolutions: boolean;
  forkedFrom: string | null;
  solutionFilesLimit: number | null;
  solutionSizeLimit: number | null;
  mergeJudgeLogs?: boolean;
  permissionHints?: Record<string, boolean>;
}

const fetchExercise = cache(async function fetchExercise(
  exerciseId: string,
): Promise<ExerciseDetailPayload> {
  return apiGet<ExerciseDetailPayload>("/v1/exercises/{id}", { pathParams: { id: exerciseId } });
});

/**
 * Just the name, for a screen that only has to say which exercise an assignment came from (X-020).
 *
 * On the same memoized fetch `getExerciseDetail` makes, so it costs nothing on the exercise's own
 * page and one call elsewhere. **A refusal is an absent name, not an error**: an assignment may
 * outlive the reader's permission to look at the exercise behind it, and the sentence that needs
 * the name reads perfectly well without it.
 */
export const getExerciseName = cache(async function getExerciseName(
  exerciseId: string,
  locale: string,
): Promise<string | null> {
  try {
    return localizedName((await fetchExercise(exerciseId)).localizedTexts, locale) || null;
  } catch (error) {
    if (error instanceof ApiError && error.httpStatus === 403) return null;
    throw error;
  }
});

/**
 * core-api writes its validation failures as one string of `@key message` pairs, one per line
 * (`"@no-runtimes There are no runtime environments\n@no-tests ..."`, verified live). The keys are
 * a closed set the legacy app translates; anything unknown keeps core-api's own English, which is
 * better than dropping a reason nobody has a sentence for yet.
 */
function validationErrors(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function getExerciseDetail(
  exerciseId: string,
  locale: string,
): Promise<ExerciseDetail> {
  const exercise = await pageRead(fetchExercise(exerciseId));

  const peopleIds = [...new Set([exercise.authorId, ...(exercise.adminsIds ?? [])])];
  const [people, groups, files, assignments] = await Promise.all([
    apiPost<{ id: string; fullName: string }[]>("/v1/users/list", { ids: peopleIds }),
    getGroupList(locale),
    // Both of these are permitted for anyone who may read the exercise itself, and both are read
    // through the raw client so that a refusal on one does not take the page down with it.
    getExerciseFiles(exerciseId),
    apiGet<{ id: string }[]>("/v1/exercises/{id}/assignments", {
      pathParams: { id: exerciseId },
    }).catch((error: unknown) => {
      if (error instanceof ApiError && error.httpStatus === 403) return [] as { id: string }[];
      throw error;
    }),
  ]);

  const names = new Map(people.map((person) => [person.id, person.fullName]));
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const groupIds = exercise.groupsIds ?? [];
  const visibleGroups = groupIds
    .filter((id) => groupNames.has(id))
    .map((id) => ({ id, name: groupNames.get(id)! }));

  // `%%key%%` placeholders are resolved here rather than at render time (T-023): a placeholder
  // can stand inside a markdown link target, where no post-parse transform could reach it, and
  // the *editor* has to see the raw text, which is why the settings form reads `texts` from a
  // separate, unresolved copy.
  const links = linkMap(files.links);
  const rawTexts = (exercise.localizedTexts ?? []).map((entry) => ({
    locale: entry.locale,
    name: entry.name ?? "",
    text: entry.text ?? "",
    description: entry.description ?? "",
    link: entry.link ?? "",
  }));
  const texts = rawTexts.map((entry) => ({
    ...entry,
    text: replaceLinkKeys(entry.text, links),
  }));

  return {
    id: exercise.id,
    name: localizedName(exercise.localizedTexts, locale),
    version: exercise.version,
    difficulty: exercise.difficulty,
    createdAt: exercise.createdAt,
    updatedAt: exercise.updatedAt,
    archivedAt: exercise.archivedAt,
    texts,
    text: texts.find((entry) => entry.locale === locale) ?? texts[0] ?? null,
    environments: (exercise.runtimeEnvironments ?? []).map((environment) => ({
      id: environment.id,
      name: environment.name,
    })),
    tags: [...(exercise.tags ?? [])].sort(),
    author: { id: exercise.authorId, name: names.get(exercise.authorId) ?? "" },
    admins: (exercise.adminsIds ?? []).map((id) => ({ id, name: names.get(id) ?? "" })),
    groups: visibleGroups,
    undisclosedGroups: groupIds.length - visibleGroups.length,
    isPublic: exercise.isPublic,
    isLocked: exercise.isLocked,
    isBroken: exercise.isBroken,
    configurationType: exercise.configurationType ?? "simpleExerciseConfig",
    validationErrors: validationErrors(exercise.validationError),
    hasReferenceSolutions: exercise.hasReferenceSolutions,
    forkedFrom: exercise.forkedFrom,
    solutionFilesLimit: exercise.solutionFilesLimit,
    solutionSizeLimit: exercise.solutionSizeLimit,
    mergeJudgeLogs: exercise.mergeJudgeLogs ?? true,
    rawTexts,
    files: files.files.map((file) => ({ id: file.id, name: file.name, size: file.size })),
    fileLinks: files.links,
    assignmentCount: assignments.length,
    can: exercise.permissionHints ?? {},
  };
}
