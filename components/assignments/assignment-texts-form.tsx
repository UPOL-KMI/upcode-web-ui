"use client";

import { FormProvider } from "react-hook-form";
import { useTranslations } from "next-intl";

import { updateAssignmentTexts } from "@/lib/actions/assignment";
import {
  assignmentTextsSchema,
  type AssignmentTextsValues,
} from "@/lib/actions/assignment-texts.schema";
import type { AssignmentSettings } from "@/lib/api/assignment-edit";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { Link, useRouter } from "@/i18n/navigation";
import { MarkdownPreviewTabs } from "@/components/markdown/markdown-preview-tabs";
import { Field } from "@/components/form/field";
import { SyncWithExercise } from "./sync-with-exercise";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * An assignment's own text, in each language (G-007).
 *
 * **This is an override, and the screen says so.** An assignment starts as a copy of its
 * exercise's text; until this existed, changing what a class reads meant editing the exercise --
 * which changes every other assignment made from it -- and there was no way to correct a typo for
 * one group alone. The cost of using it is the notice at the top: a re-sync replaces the text with
 * the exercise's, silently and without asking.
 *
 * **An override does not look like drift, which is why the notice has to say this.** core-api
 * calls a locale out of sync only when the exercise's copy is *newer* than the assignment's
 * (`Assignment::areLocalizedTextsInSync`), and saving here makes the assignment's the newer one --
 * so S-013's sync notice stays quiet, and the reader gets no second warning before pressing
 * re-sync for some entirely unrelated reason. The legacy app's own callout says something stronger
 * and no longer true, that an ordinary settings save overwrites these from the exercise;
 * `actionUpdateDetail` does not touch them at all.
 *
 * **Its own form, not another section of the settings form**, because core-api keeps the two
 * apart: the texts have their own endpoint, and its own comment gives the reason -- overriding
 * them "needs to be handled carefully". Two forms on one screen share one `version`, and *both*
 * saves increment it, so this one refreshes the route on success rather than navigating away:
 * without that, saving a text and then saving the settings would be answered with core-api's
 * "edited in the meantime" refusal on the reader's own edit.
 *
 * The text is markdown, edited as plain text, for the reason T-008's exercise form gives: a
 * preview pane is a bigger thing than this ticket (G-028), and it is bound to the **unresolved**
 * copy -- `%%key%%` file placeholders are resolved for display, and a form bound to the resolved
 * text would save the substituted URLs back over the author's own placeholders.
 */
export function AssignmentTextsForm({
  assignment,
  exerciseName,
  hidden,
}: {
  assignment: AssignmentSettings;
  /** The exercise this was copied from, named in the re-sync dialog. */
  exerciseName: string | null;
  /** Hidden rather than unrendered on the other tabs, so an unsaved text survives a look around. */
  hidden?: boolean;
}) {
  const t = useTranslations("AssignmentEdit");
  const router = useRouter();
  const toast = useToast();

  const { form, onSubmit, isPending } = useServerActionForm<
    AssignmentTextsValues,
    { assignmentId: string }
  >({
    schema: assignmentTextsSchema,
    defaultValues: { texts: assignment.texts },
    action: (values) => updateAssignmentTexts(assignment.id, assignment.version, values),
    onSuccess: () => {
      toast.success(t("texts.saved"));
      router.refresh();
    },
  });

  const {
    register,
    formState: { errors, isDirty },
  } = form;

  const input =
    "rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive";
  const language = (code: string) => (t.has(`language.${code}`) ? t(`language.${code}`) : code);
  const fieldError = (key: unknown) =>
    typeof key === "string" ? t(`texts.errors.${key}`) : undefined;
  // The "at least one name" issue is filed against the array itself, which RHF stores either on
  // the array's own error or under its `root`, depending on how the resolver reports it.
  const arrayError = fieldError(errors.texts?.root?.message ?? errors.texts?.message);

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => {
          if (isPending) {
            event.preventDefault();
            return;
          }
          void onSubmit(event);
        }}
        aria-labelledby="assignment-texts"
        hidden={hidden}
        className="flex flex-col gap-4"
      >
        <h2 id="assignment-texts" className="text-base font-semibold tracking-tight">
          {t("texts.title")}
        </h2>
        {/* Where the original lives, as a link rather than as an instruction to go and find it.
            An assignment without an exercise behind it (core-api allows the exercise to be
            deleted) simply gets the sentence without the link. */}
        <div className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
          <p>
            {t("texts.override")}{" "}
            {assignment.exerciseId !== null && (
              <Link
                href={`/exercises/${assignment.exerciseId}`}
                className="underline underline-offset-4 hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t("texts.openExercise")}
              </Link>
            )}
          </p>
          {/* The way back. core-api stops calling a locale out of sync once this form has saved --
              the assignment's copy is then the newer one -- so the drift notice, and with it the
              only other sync button, goes quiet permanently after an override. */}
          {assignment.exerciseId !== null && (
            <SyncWithExercise
              assignmentId={assignment.id}
              exerciseId={assignment.exerciseId}
              exerciseName={exerciseName}
              stale={assignment.staleParts}
              from="override"
              label={t("texts.restoreFromExercise")}
              warning={isDirty ? t("texts.restoreDiscardsEdits") : undefined}
            />
          )}
        </div>

        {assignment.texts.map((text, index) => (
          <fieldset
            key={text.locale}
            className="flex flex-col gap-3 rounded-lg border border-border p-4"
          >
            <legend className="px-1 text-sm font-medium">{language(text.locale)}</legend>
            <input type="hidden" {...register(`texts.${index}.locale`)} />

            <Field
              label={t("texts.name")}
              description={t("texts.nameHint")}
              error={fieldError(errors.texts?.[index]?.name?.message)}
            >
              <input
                type="text"
                className={input}
                aria-invalid={errors.texts?.[index]?.name ? true : undefined}
                {...register(`texts.${index}.name`)}
              />
            </Field>

            <Field
              label={t("texts.text")}
              description={t("texts.textHint")}
              error={fieldError(errors.texts?.[index]?.text?.message)}
            >
              <MarkdownPreviewTabs getSource={() => form.getValues(`texts.${index}.text`) ?? ""}>
                <textarea
                  rows={8}
                  className={`${input} w-full font-mono`}
                  aria-invalid={errors.texts?.[index]?.text ? true : undefined}
                  {...register(`texts.${index}.text`)}
                />
              </MarkdownPreviewTabs>
            </Field>

            <Field
              label={t("texts.link")}
              description={t("texts.linkHint")}
              error={fieldError(errors.texts?.[index]?.link?.message)}
            >
              <input
                type="url"
                className={input}
                aria-invalid={errors.texts?.[index]?.link ? true : undefined}
                {...register(`texts.${index}.link`)}
              />
            </Field>
          </fieldset>
        ))}

        {arrayError && (
          <p role="alert" className="text-sm text-destructive">
            {arrayError}
          </p>
        )}
        {errors.root?.message && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}

        <div>
          <button
            type="submit"
            aria-disabled={isPending}
            className={buttonClasses("primary", "sm")}
          >
            {isPending ? t("texts.saving") : t("texts.save")}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
