"use client";

import { FormProvider } from "react-hook-form";
import { useTranslations } from "next-intl";

import { updateExercise } from "@/lib/actions/exercise";
import { DIFFICULTIES, type ExerciseSettingsValues } from "@/lib/actions/exercise.schema";
import { exerciseSettingsSchema } from "@/lib/actions/exercise.schema";
import type { ExerciseDetail } from "@/lib/api/exercise-detail";
import { formatBytes } from "@/lib/format/bytes";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { useRouter } from "@/i18n/navigation";
import { MarkdownPreviewTabs } from "@/components/markdown/markdown-preview-tabs";
import { useToast } from "@/components/toast/toast-provider";
import { buttonClasses } from "@/components/button";

/**
 * An exercise's basic settings (T-008): what it asks in each language, how hard it is, who may see
 * it, and how big a solution may be.
 *
 * **Every locale is edited and submitted at once**, for the reason S-009's group form gives:
 * core-api replaces the whole `localizedTexts` array with what it is sent, so a form that edited
 * one language would silently delete the others. A blank name removes that language rather than
 * failing validation -- one has to survive, which is core-api's rule too.
 *
 * The exercise **text is markdown** and is edited as plain text here, the way the legacy form does
 * it: the reader can see it rendered on the detail screen, and a preview pane is a bigger thing
 * than this ticket. It is bound to `rawTexts`, not `texts` -- T-023 resolves `%%key%%` file-link
 * placeholders for *display*, and a form bound to the resolved copy would save the substituted
 * URLs back over the author's own placeholders.
 *
 * `version` rides along as core-api's optimistic lock. When somebody else saved first, its
 * `400-010` message is shown as it came rather than retried -- the honest answer is to reload and
 * look at what changed (DEC-092's reasoning, second time).
 *
 * **It is read from the props on every submit, never held in form state.** A save increments the
 * version, and `router.refresh()` below brings the new one back down as a prop; a copy captured in
 * `defaultValues` would still hold the number from mount, so the reader's second save was refused
 * as though a colleague had edited the exercise underneath them (X-023).
 */
export function ExerciseForm({
  exercise,
  locales,
}: {
  exercise: ExerciseDetail;
  locales: readonly string[];
}) {
  const t = useTranslations("ExerciseEdit.form");
  const router = useRouter();
  const toast = useToast();

  const editedLocales = [
    ...locales,
    ...exercise.rawTexts.map((text) => text.locale).filter((locale) => !locales.includes(locale)),
  ];

  const { form, onSubmit, isPending } = useServerActionForm<ExerciseSettingsValues, { id: string }>(
    {
      schema: exerciseSettingsSchema,
      defaultValues: {
        texts: editedLocales.map((locale) => {
          const existing = exercise.rawTexts.find((text) => text.locale === locale);
          return {
            locale,
            name: existing?.name ?? "",
            text: existing?.text ?? "",
            description: existing?.description ?? "",
            link: existing?.link ?? "",
          };
        }),
        difficulty: (DIFFICULTIES.find((value) => value === exercise.difficulty) ??
          "easy") as ExerciseSettingsValues["difficulty"],
        isPublic: exercise.isPublic,
        isLocked: exercise.isLocked,
        mergeJudgeLogs: exercise.mergeJudgeLogs,
        solutionFilesLimit: exercise.solutionFilesLimit,
        solutionSizeLimit: exercise.solutionSizeLimit,
      },
      action: (values) => updateExercise(exercise.id, exercise.version, values),
      onSuccess: () => {
        toast.success(t("saved"));
        router.refresh();
      },
    },
  );

  const {
    register,
    watch,
    formState: { errors },
  } = form;

  // The limit is typed in bytes because that is what core-api stores, and nobody reads 1572864 as
  // "1.5 MB" -- so the form says it back in the units a person thinks in, as they type.
  const sizeLimit = watch("solutionSizeLimit");

  const input =
    "rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring aria-invalid:border-destructive";

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
        className="flex flex-col gap-6"
      >
        {editedLocales.map((locale, index) => (
          <fieldset
            key={locale}
            className="flex flex-col gap-2 rounded-lg border border-border p-4"
          >
            <legend className="px-1 text-sm font-medium">{t("locale", { locale })}</legend>
            <input type="hidden" {...register(`texts.${index}.locale`)} />
            <label className="flex flex-col gap-1 text-sm">
              {t("name")}
              <input type="text" className={input} {...register(`texts.${index}.name`)} />
            </label>
            <div className="flex flex-col gap-1 text-sm">
              <label htmlFor={`texts.${index}.text`}>{t("text")}</label>
              {/* G-028. The field is untouched -- the tabs wrap it and read it, so nothing about
                  what gets submitted changes. This is the text KaTeX appears in, which is why it
                  is the field a preview matters most for. */}
              <MarkdownPreviewTabs getSource={() => form.getValues(`texts.${index}.text`) ?? ""}>
                <textarea
                  id={`texts.${index}.text`}
                  rows={8}
                  aria-describedby={`texts.${index}.text-hint`}
                  className={`${input} w-full font-mono`}
                  {...register(`texts.${index}.text`)}
                />
              </MarkdownPreviewTabs>
              <span id={`texts.${index}.text-hint`} className="text-xs text-muted-foreground">
                {t("textHint")}
              </span>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <label htmlFor={`texts.${index}.description`}>{t("description")}</label>
              <textarea
                id={`texts.${index}.description`}
                rows={2}
                aria-describedby={`texts.${index}.description-hint`}
                className={input}
                {...register(`texts.${index}.description`)}
              />
              <span
                id={`texts.${index}.description-hint`}
                className="text-xs text-muted-foreground"
              >
                {t("descriptionHint")}
              </span>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <label htmlFor={`texts.${index}.link`}>{t("link")}</label>
              <input
                type="url"
                id={`texts.${index}.link`}
                aria-describedby={`texts.${index}.link-hint`}
                className={input}
                {...register(`texts.${index}.link`)}
              />
              <span id={`texts.${index}.link-hint`} className="text-xs text-muted-foreground">
                {t("linkHint")}
              </span>
            </div>
          </fieldset>
        ))}

        <label className="flex flex-col gap-1 text-sm sm:w-64">
          {t("difficulty")}
          <select className={input} {...register("difficulty")}>
            {DIFFICULTIES.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {t(`difficulties.${difficulty}`)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4" {...register("isPublic")} />
            {t("isPublic")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4" {...register("isLocked")} />
            {t("isLocked")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4" {...register("mergeJudgeLogs")} />
            {t("mergeJudgeLogs")}
          </label>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm">
            {t("solutionFilesLimit")}
            <input
              type="number"
              min={1}
              className={`${input} w-32`}
              {...register("solutionFilesLimit", {
                setValueAs: (value) => (value === "" ? null : Number(value)),
              })}
            />
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor="solutionSizeLimit">{t("solutionSizeLimit")}</label>
            <input
              type="number"
              id="solutionSizeLimit"
              min={1}
              aria-describedby="solutionSizeLimit-hint"
              className={`${input} w-40`}
              {...register("solutionSizeLimit", {
                setValueAs: (value) => (value === "" ? null : Number(value)),
              })}
            />
            <span id="solutionSizeLimit-hint" className="text-xs text-muted-foreground">
              {typeof sizeLimit === "number" && sizeLimit > 0
                ? formatBytes(sizeLimit)
                : t("solutionSizeLimitHint")}
            </span>
          </div>
        </div>

        {errors.texts && (
          <p role="alert" className="text-sm text-destructive">
            {t("errors.nameRequired")}
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
            {isPending ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
