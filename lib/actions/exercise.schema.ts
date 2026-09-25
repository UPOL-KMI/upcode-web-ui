import * as z from "zod/mini";

/**
 * An exercise's basic settings, shared by the form and the Server Action that re-validates them
 * (T-008). Its own module, apart from the `"use server"` file, per D-004's rule.
 *
 * The rules restated here are core-api's own (`ExercisesPresenter::actionUpdateDetail`): the
 * localized texts may not be empty and each entry needs a locale, a name and a text; the two
 * solution limits are whole numbers or nothing at all ("no limit"). Difficulty is a closed set of
 * three, which the API documents as a string and this app refuses to widen.
 */
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

export const exerciseTextSchema = z.object({
  locale: z.string().check(z.minLength(2)),
  name: z.string().check(z.trim()),
  text: z.string(),
  /** The short description, which only whoever may see the exercise ever reads. */
  description: z.string(),
  /** An external address holding the full text, where the exercise keeps it outside ReCodEx. */
  link: z.string(),
});

/**
 * **`version` is deliberately not here.** core-api's optimistic lock has to be whatever the *server*
 * last said, and a value inside the form is whatever it said when the form mounted: a second save
 * after a successful first one would send the stale number and be refused. It is passed to the
 * action from the current props instead, as every other versioned form in this app does.
 */
export const exerciseSettingsSchema = z
  .object({
    texts: z.array(exerciseTextSchema).check(z.minLength(1)),
    difficulty: z.enum(DIFFICULTIES),
    isPublic: z.boolean(),
    isLocked: z.boolean(),
    mergeJudgeLogs: z.boolean(),
    solutionFilesLimit: z.nullable(z.number().check(z.int(), z.minimum(1))),
    solutionSizeLimit: z.nullable(z.number().check(z.int(), z.minimum(1))),
  })
  .check(
    z.superRefine((values, ctx) => {
      // A locale is offered for every language this app speaks; an empty name means "this exercise
      // has no text in that language" and the action drops it, which is how core-api removes one.
      // At least one has to survive, or the exercise becomes unnameable -- and core-api refuses an
      // empty `localizedTexts` outright.
      if (!values.texts.some((text) => text.name.trim() !== "")) {
        ctx.addIssue({ code: "custom", path: ["texts"], message: "nameRequired" });
      }
    }),
  );

export type ExerciseSettingsValues = z.infer<typeof exerciseSettingsSchema>;
