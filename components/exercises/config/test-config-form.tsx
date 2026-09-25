"use client";

import { FormProvider, useFormContext } from "react-hook-form";

import { entryPointChoices, entryPointIsUndelivered } from "@/lib/exercise-config/entry-point";
import { useTranslations } from "next-intl";

import { updateExerciseConfig } from "@/lib/actions/exercise-config";
import { configSchema, type ConfigValues } from "@/lib/actions/exercise-config.schema";
import type { ConfigCapabilities, SimpleConfigValues } from "@/lib/exercise-config/simple-config";
import { useServerActionForm } from "@/lib/forms/use-server-action-form";

import { Link, useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/toast/toast-provider";

import { FileListField, FilePairListField, FileSelect, StringListField } from "./fields";
import { buttonClasses } from "@/components/button";

/**
 * What each test actually does (T-009) -- the screen the brief calls the hardest in the product,
 * and the reason it is: one form holds every test of the exercise, and each test holds values that
 * are shared by every language it supports alongside values that are held per language.
 *
 * The split is not arbitrary. What a test *is* -- its input, the output it expects, the judge that
 * compares them -- is the same whatever language wrote the solution. How a solution is *built and
 * started* is not: an entry point, a compiler flag, an acceptable exit code all belong to one
 * environment. So the shared half is edited once and the per-environment half repeats.
 *
 * **Which fields exist is read off the instance's pipelines, not assumed** (`configCapabilities`).
 * Java declares no entry point and C takes no jar files, so neither is offered there; a value the
 * pipelines have no variable for is one core-api would refuse.
 *
 * The nine built-in judges are named here because they are named nowhere else: core-api validates
 * `judge-type` against its own list but does not publish it, so the list is the legacy app's,
 * carried over whole.
 */
const JUDGES = [
  "recodex-judge-normal",
  "recodex-judge-float",
  "recodex-judge-normal-newline",
  "recodex-judge-float-newline",
  "recodex-judge-shuffle",
  "recodex-judge-shuffle-rows",
  "recodex-judge-shuffle-all",
  "recodex-judge-shuffle-newline",
  "diff",
] as const;

const INPUT =
  "rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring";

export function TestConfigForm({
  exerciseId,
  values,
  testNames,
  environments,
  environmentNames,
  capabilities,
  files,
  readOnly,
}: {
  exerciseId: string;
  values: SimpleConfigValues;
  testNames: Record<string, string>;
  environments: string[];
  environmentNames: Record<string, string>;
  capabilities: ConfigCapabilities;
  files: string[];
  readOnly: boolean;
}) {
  const t = useTranslations("ExerciseConfig.config");
  const router = useRouter();
  const toast = useToast();

  const { form, onSubmit, isPending } = useServerActionForm<ConfigValues, { tests: number }>({
    schema: configSchema,
    defaultValues: values as ConfigValues,
    action: (submitted) => updateExerciseConfig(exerciseId, submitted),
    onSuccess: () => {
      toast.success(t("saved"));
      router.refresh();
    },
  });

  const {
    formState: { errors },
  } = form;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {/* **Not grey when it blocks.** With no files attached there is nothing to choose for the
            expected output, so on an exercise whose pipelines demand one this is the reason it
            cannot be assigned -- and it read as a footnote. The way out is one click, here. */}
        {files.length === 0 && (
          <div
            className={
              capabilities.needsExpectedOutput
                ? "flex flex-col items-start gap-2 rounded-lg border border-destructive bg-destructive-surface p-3 text-sm"
                : "flex flex-col items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm"
            }
          >
            <p>{t("noFiles")}</p>
            <Link
              href={`/exercises/${exerciseId}/edit?tab=files`}
              className={buttonClasses("outline", "sm")}
            >
              {t("manageFiles")}
            </Link>
          </div>
        )}

        {/* And when there are files, the same door, quietly. */}
        {files.length > 0 && (
          <div>
            <Link
              href={`/exercises/${exerciseId}/edit?tab=files`}
              className="text-sm underline underline-offset-4 hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("manageFiles")}
            </Link>
          </div>
        )}

        {values.tests.map((test, index) => {
          // **The one value core-api will not compile without**, checked here so the teacher reads
          // it at the field rather than as "the chosen languages have no configuration" on the next
          // screen. Whether it is required at all is the instance's own pipelines' answer, not a
          // guess: a data-only exercise's pipeline declares no expected output and needs none.
          const missingExpectedOutput =
            capabilities.needsExpectedOutput && !values.tests[index]?.expectedOutput;
          return (
            <details
              key={test.id}
              open={values.tests.length === 1 || missingExpectedOutput}
              className={
                missingExpectedOutput
                  ? "rounded-lg border border-destructive"
                  : "rounded-lg border border-border"
              }
            >
              <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
                {testNames[test.id] ?? test.id}
                {missingExpectedOutput && (
                  <span className="ml-2 text-xs font-normal text-destructive">
                    {t("missingExpectedOutput")}
                  </span>
                )}
              </summary>
              <div className="flex flex-col gap-6 border-t border-border p-4">
                <SharedFields
                  index={index}
                  files={files}
                  readOnly={readOnly}
                  canCompareFile={capabilities.canCompareFile}
                  missingExpectedOutput={missingExpectedOutput}
                />
                {environments.map((environmentId) => (
                  <EnvironmentFields
                    key={environmentId}
                    index={index}
                    environmentId={environmentId}
                    environmentName={environmentNames[environmentId] ?? environmentId}
                    fields={capabilities.environments[environmentId]}
                    files={files}
                    readOnly={readOnly}
                    onlyOne={environments.length === 1}
                  />
                ))}
              </div>
            </details>
          );
        })}

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={isPending} className={buttonClasses("primary", "sm")}>
              {isPending ? t("saving") : t("save")}
            </button>
            <p className="text-xs text-muted-foreground">{t("saveNote")}</p>
          </div>
        )}

        {errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}
      </form>
    </FormProvider>
  );
}

function SharedFields({
  index,
  files,
  readOnly,
  canCompareFile,
  missingExpectedOutput,
}: {
  index: number;
  files: string[];
  readOnly: boolean;
  canCompareFile: boolean;
  missingExpectedOutput: boolean;
}) {
  const t = useTranslations("ExerciseConfig.config");
  const { register, watch } = useFormContext<ConfigValues>();
  const useOutFile = watch(`tests.${index}.useOutFile`);
  const useCustomJudge = watch(`tests.${index}.useCustomJudge`);
  const judgeType = watch(`tests.${index}.judgeType`);

  return (
    // **Two columns, never four, and every panel drawn.** Four tracks of form fields on one line
    // left each one too narrow for a file name, and a `<fieldset>` will not shrink below its
    // content (the browser's own `min-inline-size: min-content`) -- so the columns overlapped
    // instead of wrapping, which is what the operator was looking at. `min-w-0` lifts that floor;
    // the border turns four floating headings into four visibly separate groups.
    <div className="grid gap-4 md:grid-cols-2">
      <fieldset className="flex min-w-0 flex-col gap-3 rounded-md border border-border/60 p-3">
        <legend className="px-1 text-sm font-semibold">{t("input")}</legend>
        <FilePairListField
          name={`tests.${index}.inputFiles`}
          label={t("inputFiles")}
          files={files}
          readOnly={readOnly}
          description={t("inputFilesExplain")}
        />
        <FileSelect
          name={`tests.${index}.stdinFile`}
          label={t("stdinFile")}
          files={files}
          readOnly={readOnly}
          description={t("stdinFileExplain")}
        />
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-3 rounded-md border border-border/60 p-3">
        <legend className="px-1 text-sm font-semibold">{t("execution")}</legend>
        <StringListField
          name={`tests.${index}.runArgs`}
          label={t("runArgs")}
          readOnly={readOnly}
          description={t("runArgsExplain")}
        />
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-3 rounded-md border border-border/60 p-3">
        <legend className="px-1 text-sm font-semibold">{t("output")}</legend>
        {canCompareFile && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              aria-label={t("useOutFile")}
              disabled={readOnly}
              {...register(`tests.${index}.useOutFile`)}
            />
            <span>
              {t("useOutFile")}
              <span className="block text-xs text-muted-foreground">{t("useOutFileExplain")}</span>
            </span>
          </label>
        )}
        {canCompareFile && useOutFile && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("actualOutput")}</span>
            <input
              type="text"
              className={`${INPUT} font-mono`}
              aria-label={t("actualOutput")}
              disabled={readOnly}
              {...register(`tests.${index}.actualOutput`)}
            />
            <span className="text-xs text-muted-foreground">{t("actualOutputExplain")}</span>
          </label>
        )}
        <FileSelect
          name={`tests.${index}.expectedOutput`}
          label={t("expectedOutput")}
          files={files}
          readOnly={readOnly}
          description={t("expectedOutputExplain")}
          error={missingExpectedOutput ? t("expectedOutputRequired") : undefined}
        />
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-3 rounded-md border border-border/60 p-3">
        <legend className="px-1 text-sm font-semibold">{t("judge")}</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            aria-label={t("useCustomJudge")}
            disabled={readOnly}
            {...register(`tests.${index}.useCustomJudge`)}
          />
          <span>
            {t("useCustomJudge")}
            <span className="block text-xs text-muted-foreground">
              {t("useCustomJudgeExplain")}
            </span>
          </span>
        </label>
        {useCustomJudge ? (
          <>
            <FileSelect
              name={`tests.${index}.customJudge`}
              label={t("customJudge")}
              files={files}
              readOnly={readOnly}
            />
            <StringListField
              name={`tests.${index}.judgeArgs`}
              label={t("judgeArgs")}
              readOnly={readOnly}
              description={t("judgeArgsExplain")}
            />
          </>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("judgeType")}</span>
            <select
              className={INPUT}
              aria-label={t("judgeType")}
              disabled={readOnly}
              {...register(`tests.${index}.judgeType`)}
            >
              {JUDGES.map((judge) => (
                <option key={judge} value={judge}>
                  {t(`judges.${judge}`)}
                </option>
              ))}
            </select>
            {/* What the chosen comparison actually does, under the control that chose it. The
                names alone ("Tokeny v libovolném pořadí") do not say whether that means within a
                line or across lines -- the distinction the judges themselves draw
                (`--shuffled-tokens` vs `--shuffled-lines`, read out of the worker's own judge). */}
            <span className="text-xs text-muted-foreground">{t(`judgeExplain.${judgeType}`)}</span>
          </label>
        )}
      </fieldset>
    </div>
  );
}

function EnvironmentFields({
  index,
  environmentId,
  environmentName,
  fields,
  files,
  readOnly,
  onlyOne,
}: {
  index: number;
  environmentId: string;
  environmentName: string;
  fields: import("@/lib/exercise-config/simple-config").EnvironmentFields | undefined;
  files: string[];
  readOnly: boolean;
  onlyOne: boolean;
}) {
  const t = useTranslations("ExerciseConfig.config");
  const { register, watch } = useFormContext<ConfigValues>();

  // Watched rather than read once: the warning below is about the relationship between two fields
  // in this very fieldset, and it has to answer while the author is still fixing it.
  const path = `tests.${index}.environments.${environmentId}` as const;
  const entryPoint = watch(`${path}.entryPoint`) ?? "";
  const extraFiles = watch(`${path}.extraFiles`) ?? [];

  if (!fields) return null;
  const shown =
    fields.entryPoint ||
    fields.successExitCodes ||
    fields.extraFiles ||
    fields.jarFiles ||
    fields.compileArgs ||
    fields.execTargets;
  if (!shown) return null;

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
      <legend className="px-1 text-xs font-semibold tracking-wide uppercase">
        {onlyOne ? t("perEnvironmentOnly", { environment: environmentName }) : environmentName}
      </legend>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.entryPoint && (
          <FileSelect
            name={`${path}.entryPoint`}
            label={t("entryPoint")}
            // Only what this test's extra files deliver. Offering the exercise's attachments was
            // the trap: they look available and are not.
            files={entryPointChoices(extraFiles)}
            readOnly={readOnly}
            description={
              entryPointChoices(extraFiles).length === 0
                ? t("entryPointNeedsExtraFiles")
                : t("entryPointExplain")
            }
            warning={
              entryPointIsUndelivered(entryPoint, extraFiles, files)
                ? t("entryPointNotDelivered")
                : undefined
            }
          />
        )}
        {fields.successExitCodes && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("successExitCodes")}</span>
            <input
              type="text"
              className={`${INPUT} font-mono`}
              aria-label={t("successExitCodes")}
              disabled={readOnly}
              {...register(`${path}.successExitCodes`)}
            />
            <span className="text-xs text-muted-foreground">{t("successExitCodesExplain")}</span>
          </label>
        )}
        {fields.extraFiles && (
          <FilePairListField
            name={`${path}.extraFiles`}
            label={t("extraFiles")}
            files={files}
            readOnly={readOnly}
            description={t("extraFilesExplain")}
          />
        )}
        {fields.jarFiles && (
          <FileListField
            name={`${path}.jarFiles`}
            label={t("jarFiles")}
            files={files}
            readOnly={readOnly}
            description={t("jarFilesExplain")}
          />
        )}
        {fields.compileArgs && (
          <StringListField
            name={`${path}.compileArgs`}
            label={t("compileArgs")}
            readOnly={readOnly}
            description={t("compileArgsExplain")}
          />
        )}
        {fields.execTargets && (
          <StringListField
            name={`${path}.execTargets`}
            label={t("execTargets")}
            readOnly={readOnly}
            description={t("execTargetsExplain")}
          />
        )}
      </div>
    </fieldset>
  );
}
