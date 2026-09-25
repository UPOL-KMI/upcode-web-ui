import "server-only";

import { cache } from "react";

import { stalePartsOf, type SynchronizationInfo } from "./assignment";
import { apiRead } from "./read";

/**
 * An assignment as its own settings form needs it (T-002).
 *
 * A separate read from `getAssignmentDetail`, and deliberately so: that one is shaped for the two
 * screens that *display* an assignment and drops everything a reader cannot act on, while this one
 * needs the fields core-api's `updateDetail` will demand back -- including `version`, which is the
 * optimistic lock, and the four `canView*` flags and the per-locale student hints that no display
 * screen shows.
 *
 * **`updateDetail` replaces the assignment with what it is sent.** Every field it reads has to be
 * present on every save, which is why the form is seeded from this rather than from a subset: a
 * field left out of the payload is a field reset.
 *
 * `environments` is the list the exercise supports; `disabledEnvironments` is the subset a teacher
 * has switched off for submissions. core-api takes the *disabled* ids, so that is what is stored
 * here rather than the inverse.
 */
export interface AssignmentStudentHint {
  locale: string;
  hint: string;
}

/**
 * One language of the assignment's own text (G-007), exactly as it is stored -- `%%key%%`
 * placeholders and all. The editor has to see what the author wrote, so this is *not* the resolved
 * copy `getAssignmentDetail` renders, the same split `getExerciseDetail` makes between `rawTexts`
 * and `texts`.
 *
 * `description` is missing on purpose: core-api carries the exercise's own description over on
 * every save of these (`actionUpdateLocalizedTexts` reads it off the exercise), so it is not the
 * assignment's to edit.
 */
export interface AssignmentText {
  locale: string;
  name: string;
  text: string;
  link: string;
}

export interface AssignmentSettings {
  id: string;
  name: string;
  version: number;
  groupId: string | null;
  exerciseId: string | null;
  /** Parts that have fallen behind the exercise -- what the re-sync dialog may offer (X-020). */
  staleParts: string[];
  isPublic: boolean;
  isBonus: boolean;
  isExam: boolean;
  visibleFrom: number | null;
  firstDeadline: number;
  maxPointsFirst: number;
  allowSecondDeadline: boolean;
  /** core-api sends `0` rather than null when there is no second deadline. */
  secondDeadline: number | null;
  maxPointsSecond: number;
  interpolatePoints: boolean;
  /** Percent of the test suite that must pass before any points are awarded, as a whole percent. */
  pointsThreshold: number;
  submissionsCountLimit: number;
  solutionFilesLimit: number | null;
  solutionSizeLimit: number | null;
  environments: string[];
  disabledEnvironments: string[];
  canViewLimitRatios: boolean;
  canViewMeasuredValues: boolean;
  canViewJudgeStdout: boolean;
  canViewJudgeStderr: boolean;
  hints: AssignmentStudentHint[];
  texts: AssignmentText[];
  can: Record<string, boolean>;
}

interface SettingsPayload {
  id: string;
  version: number;
  groupId: string | null;
  exerciseId: string | null;
  isPublic: boolean;
  isBonus: boolean;
  isExam: boolean;
  visibleFrom: number | null;
  firstDeadline: number;
  secondDeadline: number;
  allowSecondDeadline: boolean;
  maxPointsBeforeFirstDeadline: number;
  maxPointsBeforeSecondDeadline: number;
  maxPointsDeadlineInterpolation: boolean;
  pointsPercentualThreshold: number;
  submissionsCountLimit: number;
  solutionFilesLimit: number | null;
  solutionSizeLimit: number | null;
  runtimeEnvironmentIds?: string[];
  disabledRuntimeEnvironmentIds?: string[];
  canViewLimitRatios: boolean;
  canViewMeasuredValues: boolean;
  canViewJudgeStdout: boolean;
  canViewJudgeStderr: boolean;
  localizedTexts?: {
    locale: string;
    name?: string;
    text?: string;
    link?: string;
    studentHint?: string;
  }[];
  permissionHints?: Record<string, boolean>;
  exerciseSynchronizationInfo?: SynchronizationInfo;
}

export const getAssignmentSettings = cache(async function getAssignmentSettings(
  assignmentId: string,
  locale: string,
  locales: readonly string[],
): Promise<AssignmentSettings> {
  const assignment = await apiRead<SettingsPayload>("/v1/exercise-assignments/{id}", {
    pathParams: { id: assignmentId },
  });

  const texts = assignment.localizedTexts ?? [];
  const named = texts.find((text) => text.locale === locale) ?? texts[0];
  // Every language this app speaks, plus any other one the assignment already carries. The second
  // half matters because **both saves replace a whole collection**: core-api's `updateCollection`
  // deletes any locale the payload omits, so a form that only knew about `en` and `cs` would throw
  // away a third language's text -- and its hint -- the first time either was saved.
  const editedLocales = [
    ...locales,
    ...texts.map((text) => text.locale).filter((code) => !locales.includes(code)),
  ];

  return {
    id: assignment.id,
    name: named?.name ?? "",
    version: assignment.version,
    groupId: assignment.groupId,
    exerciseId: assignment.exerciseId,
    staleParts: stalePartsOf(assignment.exerciseSynchronizationInfo),
    isPublic: assignment.isPublic,
    isBonus: assignment.isBonus,
    isExam: assignment.isExam,
    visibleFrom: assignment.visibleFrom,
    firstDeadline: assignment.firstDeadline,
    maxPointsFirst: assignment.maxPointsBeforeFirstDeadline,
    allowSecondDeadline: assignment.allowSecondDeadline,
    secondDeadline: assignment.secondDeadline > 0 ? assignment.secondDeadline : null,
    maxPointsSecond: assignment.maxPointsBeforeSecondDeadline,
    interpolatePoints: assignment.maxPointsDeadlineInterpolation,
    // core-api stores the threshold as a fraction and takes it back as a whole percent, which is
    // the one asymmetry in this endpoint -- `round(post / 100)` on the way in.
    pointsThreshold: Math.round(assignment.pointsPercentualThreshold * 100),
    submissionsCountLimit: assignment.submissionsCountLimit,
    solutionFilesLimit: assignment.solutionFilesLimit,
    solutionSizeLimit: assignment.solutionSizeLimit,
    environments: assignment.runtimeEnvironmentIds ?? [],
    disabledEnvironments: assignment.disabledRuntimeEnvironmentIds ?? [],
    canViewLimitRatios: assignment.canViewLimitRatios,
    canViewMeasuredValues: assignment.canViewMeasuredValues,
    canViewJudgeStdout: assignment.canViewJudgeStdout,
    canViewJudgeStderr: assignment.canViewJudgeStderr,
    // A row per locale, so a hint can be added in a language the assignment has no text in yet.
    hints: editedLocales.map((code) => ({
      locale: code,
      hint: texts.find((text) => text.locale === code)?.studentHint ?? "",
    })),
    texts: editedLocales.map((code) => {
      const existing = texts.find((text) => text.locale === code);
      return {
        locale: code,
        name: existing?.name ?? "",
        text: existing?.text ?? "",
        link: existing?.link ?? "",
      };
    }),
    can: assignment.permissionHints ?? {},
  };
});
