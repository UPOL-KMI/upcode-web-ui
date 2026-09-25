"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

import { exerciseSettingsSchema, type ExerciseSettingsValues } from "./exercise.schema";

/**
 * Everything that writes to an exercise's basic settings (T-008).
 *
 * **Creating one is a single call that produces a broken exercise on purpose** -- core-api's
 * `actionCreate` takes a group, applies defaults, names it "Exercise by <author>" in the author's
 * own language and leaves it without tests. So creating lands the reader straight on the settings
 * form, exactly as assigning lands them on T-002's (DEC-093): there is no wizard to lose halfway,
 * and the thing is real from the first click. It is invisible to students until it is assigned
 * anywhere, so a half-written exercise harms nobody.
 *
 * **The settings save carries every field, because core-api replaces the exercise with what it is
 * sent** -- the same shape as an assignment's (DEC-092) -- and `version` rides along as the
 * optimistic lock whose `400-010` is surfaced verbatim rather than retried.
 *
 * None of these checks whether the caller may write: core-api's `canUpdate`, `canRemove`,
 * `canArchive`, `canAddTag`, `canAttachGroup` and the rest decide on every call, and they are the
 * boundary (brief §6). The hints only decide what the UI offers. No `revalidatePath` (DEC-021):
 * every read is `no-store`, and the caller refreshes the router.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("ExerciseEdit.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

export async function createExercise(groupId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const exercise = await apiPost<{ id: string }>("/v1/exercises", { groupId });
    return { success: true, data: { id: exercise.id } };
  } catch (error) {
    return failure(error, "createFailed");
  }
}

/**
 * `version` is a parameter rather than a form field: it is core-api's optimistic lock, and the only
 * correct value is the one the *server* last sent. Held in form state it froze at mount, so a
 * second save after a successful first one was refused with `400-010` -- the reader's own earlier
 * save reported back as somebody else's.
 */
export async function updateExercise(
  exerciseId: string,
  version: number,
  values: ExerciseSettingsValues,
): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("ExerciseEdit.errors");
  const parsed = exerciseSettingsSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  const texts = parsed.data.texts
    .filter((text) => text.name.trim() !== "")
    .map((text) => ({
      locale: text.locale,
      name: text.name.trim(),
      text: text.text,
      description: text.description,
      // core-api stores an absent link as an empty string; sending `null` would be a type error
      // on its side, not an erasure.
      link: text.link.trim(),
    }));

  try {
    await apiPost(
      "/v1/exercises/{id}",
      {
        version,
        difficulty: parsed.data.difficulty,
        localizedTexts: texts,
        isPublic: parsed.data.isPublic,
        isLocked: parsed.data.isLocked,
        mergeJudgeLogs: parsed.data.mergeJudgeLogs,
        solutionFilesLimit: parsed.data.solutionFilesLimit,
        solutionSizeLimit: parsed.data.solutionSizeLimit,
      },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: { id: exerciseId } };
  } catch (error) {
    return failure(error, "saveFailed");
  }
}

export async function addExerciseTag(
  exerciseId: string,
  tag: string,
): Promise<ActionResult<{ tag: string }>> {
  const t = await getTranslations("ExerciseEdit.errors");
  const name = tag.trim();
  // **core-api's own rule, character for character** (`ExerciseTags::verifyTagName`,
  // `/^[-a-zA-Z0-9_]{1,32}$/`). It used to be `[\w.-]`, which is neither: `\w` without the `u`
  // flag is ASCII-only, so a Czech tag was refused here with our message and no explanation, while
  // a dot was *accepted* here and refused by core-api in English. Checked against the running
  // instance rather than read: `řazení` and `s.teckou` are refused, `s_podtrzitkem` and `UPPER`
  // are not.
  if (!/^[-a-zA-Z0-9_]{1,32}$/.test(name)) return { success: false, formError: t("invalidTag") };

  try {
    await apiPost("/v1/exercises/{id}/tags/{name}", undefined, {
      pathParams: { id: exerciseId, name },
    });
    return { success: true, data: { tag: name } };
  } catch (error) {
    return failure(error, "tagFailed");
  }
}

export async function removeExerciseTag(
  exerciseId: string,
  tag: string,
): Promise<ActionResult<{ tag: string }>> {
  try {
    await apiDelete("/v1/exercises/{id}/tags/{name}", {
      pathParams: { id: exerciseId, name: tag },
    });
    return { success: true, data: { tag } };
  } catch (error) {
    return failure(error, "tagFailed");
  }
}

export async function attachExerciseGroup(
  exerciseId: string,
  groupId: string,
): Promise<ActionResult<{ groupId: string }>> {
  try {
    await apiPost("/v1/exercises/{id}/groups/{groupId}", undefined, {
      pathParams: { id: exerciseId, groupId },
    });
    return { success: true, data: { groupId } };
  } catch (error) {
    return failure(error, "groupFailed");
  }
}

export async function detachExerciseGroup(
  exerciseId: string,
  groupId: string,
): Promise<ActionResult<{ groupId: string }>> {
  try {
    await apiDelete("/v1/exercises/{id}/groups/{groupId}", {
      pathParams: { id: exerciseId, groupId },
    });
    return { success: true, data: { groupId } };
  } catch (error) {
    return failure(error, "groupFailed");
  }
}

/** Archiving hides an exercise from the catalog and freezes it; the assignments made from it are
 *  untouched, which is what makes this reversible in a way deletion is not. */
export async function setExerciseArchived(
  exerciseId: string,
  archived: boolean,
): Promise<ActionResult<{ archived: boolean }>> {
  try {
    await apiPost("/v1/exercises/{id}/archived", { archived }, { pathParams: { id: exerciseId } });
    return { success: true, data: { archived } };
  } catch (error) {
    return failure(error, "archiveFailed");
  }
}

/**
 * Emails every group admin and supervisor who has this exercise assigned (G-019).
 *
 * An empty message is core-api's own documented case, not an omission: it sends a generic "this
 * exercise changed" notice instead. The payload is the **number of people written to**, which the
 * caller reports -- zero is a real answer rather than a failure, since a recipient can turn these
 * off in their own settings.
 */
export async function sendExerciseNotification(
  exerciseId: string,
  message: string,
): Promise<ActionResult<{ notified: number }>> {
  try {
    const notified = await apiPost<number>(
      "/v1/exercises/{id}/notification",
      { message: message.trim() },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: { notified } };
  } catch (error) {
    return failure(error, "notificationFailed");
  }
}

export async function deleteExercise(exerciseId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await apiDelete("/v1/exercises/{id}", { pathParams: { id: exerciseId } });
    return { success: true, data: { id: exerciseId } };
  } catch (error) {
    return failure(error, "deleteFailed");
  }
}
