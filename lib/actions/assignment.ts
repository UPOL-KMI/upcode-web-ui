"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import { isSyncPart } from "@/lib/assignments/sync-parts";
import type { ActionResult } from "@/lib/forms/action-result";

import { assignmentSettingsSchema, type AssignmentSettingsValues } from "./assignment.schema";
import { assignmentTextsSchema, type AssignmentTextsValues } from "./assignment-texts.schema";

/**
 * Editing an assignment (T-002), and re-syncing it with the exercise it was copied from.
 *
 * **`updateDetail` replaces the assignment with what it is sent**, so the payload is complete on
 * every save -- a field omitted is a field reset, not a field left alone. `version` is core-api's
 * optimistic lock: it answers `400-010` when someone else saved in the meantime, and that message
 * is surfaced verbatim rather than retried, because the honest response is to reload and look at
 * what changed.
 *
 * The threshold is the one asymmetric field: core-api stores a fraction and takes a whole percent.
 *
 * core-api decides who may do any of this (`canUpdate`, `canSyncWithExercise`) on every call. No
 * `revalidatePath` (DEC-021).
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("AssignmentEdit.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

export async function updateAssignment(
  assignmentId: string,
  version: number,
  values: AssignmentSettingsValues,
): Promise<ActionResult<{ assignmentId: string }>> {
  const t = await getTranslations("AssignmentEdit.errors");
  const parsed = assignmentSettingsSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  const data = parsed.data;
  const firstDeadline = data.firstDeadline;
  const secondDeadline = data.secondDeadline;
  if (firstDeadline === null || (data.allowSecondDeadline && secondDeadline === null)) {
    return { success: false, formError: t("invalid") };
  }

  try {
    await apiPost(
      "/v1/exercise-assignments/{id}",
      {
        version,
        isPublic: data.isPublic,
        isBonus: data.isBonus,
        isExam: data.isExam,
        ...(data.visibleFrom !== null && { visibleFrom: data.visibleFrom }),
        firstDeadline,
        maxPointsBeforeFirstDeadline: data.maxPointsFirst,
        allowSecondDeadline: data.allowSecondDeadline,
        ...(data.allowSecondDeadline && {
          secondDeadline,
          maxPointsBeforeSecondDeadline: data.maxPointsSecond,
        }),
        maxPointsDeadlineInterpolation: data.interpolatePoints,
        pointsPercentualThreshold: data.pointsThreshold,
        submissionsCountLimit: data.submissionsCountLimit,
        solutionFilesLimit: data.solutionFilesLimit,
        solutionSizeLimit: data.solutionSizeLimit,
        disabledRuntimeEnvironmentIds: data.disabledEnvironments,
        canViewLimitRatios: data.canViewLimitRatios,
        canViewMeasuredValues: data.canViewMeasuredValues,
        canViewJudgeStdout: data.canViewJudgeStdout,
        canViewJudgeStderr: data.canViewJudgeStderr,
        localizedStudentHints: Object.fromEntries(
          data.hints.map((hint) => [hint.locale, hint.hint]),
        ),
        ...(data.sendNotification !== null && { sendNotification: data.sendNotification }),
      },
      { pathParams: { id: assignmentId } },
    );
    return { success: true, data: { assignmentId } };
  } catch (error) {
    return failure(error, "updateFailed");
  }
}

/**
 * Override the assignment's own localized texts (G-007).
 *
 * **A separate endpoint, and separate on purpose.** core-api's own comment says why: the texts
 * arrive as a copy of the exercise's, so changing them is an override that "needs to be handled
 * carefully", and a re-sync puts the exercise's back. `updateDetail` does not touch them at all --
 * it carries the per-locale *hints*, which belong to the assignment and survive a sync.
 *
 * A language is removed by leaving its name blank: `Localizations::updateCollection` replaces the
 * whole collection with what it is sent, so an omitted locale is a deleted translation. The
 * description is not sent because it is not the assignment's -- core-api reads it off the exercise
 * on every save of these.
 *
 * `version` is the same optimistic lock the settings save uses, and it is **incremented by this
 * call too**, which is why the caller refreshes: the settings form on the same screen is holding
 * the number this save has just made stale.
 */
export async function updateAssignmentTexts(
  assignmentId: string,
  version: number,
  values: AssignmentTextsValues,
): Promise<ActionResult<{ assignmentId: string }>> {
  const t = await getTranslations("AssignmentEdit.errors");
  const parsed = assignmentTextsSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  const texts = parsed.data.texts
    .filter((text) => text.name.trim() !== "")
    .map((text) => ({
      locale: text.locale,
      name: text.name.trim(),
      text: text.text,
      // core-api stores an absent link as null and trims what it is given; an empty string is how
      // this app says "there is none", the same as the exercise form (T-008).
      link: text.link.trim(),
    }));

  try {
    await apiPost(
      "/v1/exercise-assignments/{id}/localized-texts",
      { version, localizedTexts: texts },
      { pathParams: { id: assignmentId } },
    );
    return { success: true, data: { assignmentId } };
  } catch (error) {
    return failure(error, "textsFailed");
  }
}

/**
 * Pull chosen parts of the exercise back into this assignment (X-020).
 *
 * **The selection is not optional, and an empty one is refused here rather than sent.** core-api
 * reads an empty `syncOptions` as *every* part (`Assignment::syncWithExercise` initialises each one
 * to `!$options`), so posting the reader's empty selection would do the exact opposite of what they
 * asked -- including overwriting a text they had adjusted for their own group.
 *
 * Unknown names are dropped before the call: `staleParts` deliberately surfaces a part core-api
 * grew later, and sending one back is an `Unknown sync option` refusal for the whole request.
 */
export async function syncAssignmentWithExercise(
  assignmentId: string,
  parts: readonly string[],
): Promise<ActionResult<{ assignmentId: string }>> {
  const syncOptions = parts.filter(isSyncPart);
  if (syncOptions.length === 0) {
    const t = await getTranslations("Assignment.sync");
    return { success: false, formError: t("nothingSelected") };
  }

  try {
    await apiPost(
      "/v1/exercise-assignments/{id}/sync-exercise",
      { syncOptions },
      { pathParams: { id: assignmentId } },
    );
    return { success: true, data: { assignmentId } };
  } catch (error) {
    return failure(error, "syncFailed");
  }
}

/**
 * Assign an exercise to a group (T-001).
 *
 * core-api creates the assignment with **its own defaults** -- a deadline a fortnight out, the
 * exercise's own point value -- and there is no way to hand it settings on the same call. So the
 * caller lands on T-002's form with the new assignment already real, which is also what the legacy
 * app does. An assignment that exists but is not yet public harms nobody in the meantime.
 *
 * Five things can refuse this, and only three are visible to the picker: the exercise's `assign`
 * hint and the group's `assignExercise`, plus organizational/locked/broken. The fifth -- an
 * exercise with no reference solution -- is not in any list payload, so core-api's own message is
 * what the reader gets, which is why this returns it rather than a generic failure.
 */
export async function createAssignmentFromExercise(
  exerciseId: string,
  groupId: string,
): Promise<ActionResult<{ assignmentId: string }>> {
  try {
    const created = await apiPost<{ id: string }>("/v1/exercise-assignments", {
      exerciseId,
      groupId,
    });
    return { success: true, data: { assignmentId: created.id } };
  } catch (error) {
    return failure(error, "createFailed");
  }
}

/**
 * Delete an assignment (T-002's screen, T-001's undo).
 *
 * Lives beside the settings because that is where the legacy app puts it and because it is the
 * same authority (`canRemove`, granted alongside `update`). It exists at all because T-001 made
 * creating one a click: without this, assigning an exercise by mistake would be permanent, which
 * is the shape S-026 was filed to fix for groups.
 *
 * **Everything submitted to it goes too** -- core-api removes the assignment and unschedules its
 * pending jobs -- which is why the caller confirms first.
 */
export async function deleteAssignment(
  assignmentId: string,
): Promise<ActionResult<{ assignmentId: string }>> {
  try {
    await apiDelete("/v1/exercise-assignments/{id}", { pathParams: { id: assignmentId } });
    return { success: true, data: { assignmentId } };
  } catch (error) {
    return failure(error, "deleteFailed");
  }
}
