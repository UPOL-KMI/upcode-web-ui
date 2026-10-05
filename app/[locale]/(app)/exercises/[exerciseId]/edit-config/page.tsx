import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getExerciseConfigData } from "@/lib/api/exercise-config";
import { getExerciseDetail } from "@/lib/api/exercise-detail";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
import { getHelp } from "@/lib/docs/guides";
import {
  describeValidationError,
  isDataOnly,
  validationErrorHref,
} from "@/lib/status/exercise-validation";
import { configCapabilities, readSimpleConfig } from "@/lib/exercise-config/simple-config";
import {
  configuredEnvironment,
  configuredPipelines,
  possibleEnvironmentVariables,
  readAdvancedConfig,
} from "@/lib/exercise-config/advanced-config";
import { askPipelineVariables } from "@/lib/actions/exercise-advanced";
import { extractWeights, type ScoreNode } from "@/lib/exercise-config/score-expression";

import { Link } from "@/i18n/navigation";
import { AdvancedConfigEditor } from "@/components/exercises/config/advanced-config";
import { ScoreExpressionEditor } from "@/components/exercises/config/score-expression";
import { EnvironmentsForm } from "@/components/exercises/config/environments-form";
import { TestConfigForm } from "@/components/exercises/config/test-config-form";
import { TestsForm } from "@/components/exercises/config/tests-form";
import { HelpDialog } from "@/components/help/help-dialog";
import { Markdown } from "@/components/markdown/markdown";
import { PageShell } from "@/components/page-shell";
import { PageTabs, type PageTab } from "@/components/page-tabs";
import { buttonClasses } from "@/components/button";
import { BackIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ExerciseConfig" });
  return { title: t("title") };
}

/**
 * An exercise's evaluation configuration (T-009) -- the legacy `/app/exercises/:id/edit-config`
 * route, and the screen that turns a newly created exercise from broken into assignable.
 *
 * **Three tabs, in the order a teacher answers them.** The forms used to sit under each other, and
 * the operator's verdict on that was the plain one: unreadable. *Jazyky* comes first because the
 * languages are the first decision about an exercise -- they decide which fields each test will
 * even offer (the pipelines of the chosen languages declare them), and for a data-only exercise
 * they decide whether there are tests at all (DEC-141). *Testy* holds the tests and what each of
 * them does, which is one subject: a configuration is a value per test, and there is nothing to
 * configure until a test exists. **The scoring stays with the tests** even though it is the other
 * "of your own" escape, because the choice it belongs to -- uniform, weighted, or an expression --
 * is half in the tests form (the weights) and half in the score editor, and a tab boundary through
 * the middle of one decision is worse than a longer tab. *Pokrocile nastaveni* is left holding the
 * one thing that is genuinely a different shape of exercise: a configuration of its own.
 *
 * The languages were last of the three until the operator pointed out what it meant in practice:
 * the screen opened with a section that a data-only exercise does not have.
 *
 * The reasons core-api calls the exercise broken are repeated at the top. They are the same list
 * T-021 shows, and this is the screen that answers most of them, so putting them next to the forms
 * that fix them is the point rather than duplication.
 *
 * **Two kinds of configuration, and the screen shows whichever this exercise has.** The simple
 * kind is the three forms above; the advanced kind -- built out of hand-picked pipelines -- has its
 * own editor (T-024), because rewriting one through the simple form would replace those pipelines
 * with the instance's default ones and lose everything configured on them (DEC-101). The switch
 * between them lives at the bottom of the advanced editor and is not symmetrical: going to
 * advanced loses nothing, coming back rebuilds, so only one of them confirms.
 *
 * Reading is `viewConfig`; the tests and the score are separate hints and are read even when the
 * configuration is refused, so a reader who may see one and not the other gets what they may see.
 */
export default async function EditExerciseConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ exerciseId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ exerciseId }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const [t, tExercise, tAdvanced, tScore, exercise] = await Promise.all([
    getTranslations("ExerciseConfig"),
    getTranslations("Exercise"),
    getTranslations("ExerciseAdvanced"),
    getTranslations("ExerciseScore"),
    getExerciseDetail(exerciseId, locale),
  ]);

  // Reading an exercise is something any teacher may do, so the fetch above succeeds for somebody
  // who may not see its configuration -- the trap DEC-092 records and T-008 fell into.
  if (exercise.can.viewConfig !== true) forbidden();

  const [data, help, breadcrumbs] = await Promise.all([
    getExerciseConfigData(exerciseId),
    getHelp("test-config", locale),
    resolveBreadcrumbs(`/exercises/${exerciseId}/edit-config`, locale),
  ]);

  const readOnly = exercise.can.update !== true || exercise.archivedAt !== null;
  const environmentIds = data.environments.map((entry) => entry.runtimeEnvironmentId);
  const isAdvanced = exercise.configurationType === "advancedExerciseConfig";
  // **A data-only exercise hides both of them** (DEC-141). Its single test is written for it when
  // the environment is chosen, and there is nothing to weigh when there is one test that either
  // arrived or did not -- so a screen that asks a teacher collecting essays to name tests and
  // write a score expression is asking about machinery they have no use for.
  const dataOnly = isDataOnly(environmentIds);

  const weights =
    data.score?.calculator === "weighted"
      ? ((data.score.config as { testWeights?: Record<string, number> } | null)?.testWeights ?? {})
      : {};
  // The stored expression, as weights -- null when it is not an average and therefore cannot
  // become one. Computed here rather than in the editor because it is the *choice* of calculator
  // that needs it now, and the choice is made a section above the expression.
  const storedExpression =
    data.score?.calculator === "universal"
      ? ((data.score.config as ScoreNode | null) ?? null)
      : null;
  const equivalentWeights = storedExpression ? extractWeights(storedExpression) : null;

  const advancedPipelines = isAdvanced ? configuredPipelines(data.config) : [];
  const advancedEnvironment = isAdvanced ? configuredEnvironment(data.config) : null;
  // Which variables each chosen pipeline asks for is core-api's answer, not a guess -- the one
  // endpoint T-009 never had to call, and the whole basis of the advanced editor.
  const declared =
    isAdvanced && advancedEnvironment && advancedPipelines.length > 0
      ? await askPipelineVariables(exerciseId, advancedEnvironment, advancedPipelines)
      : null;
  const advancedValues =
    declared?.success && advancedEnvironment
      ? readAdvancedConfig(data.config, data.tests, advancedEnvironment, declared.data)
      : null;

  const capabilities = configCapabilities(environmentIds, data.pipelines, data.pipelineVariables);
  const values = readSimpleConfig(data.config, data.tests, environmentIds);
  const testNames = Object.fromEntries(data.tests.map((test) => [String(test.id), test.name]));
  const environmentNames = Object.fromEntries(
    data.availableEnvironments.map((environment) => [environment.id, environment.longName]),
  );

  // **A data-only exercise is one tab.** Everything the other two hold is about tests it does not
  // have: the tests themselves, the scoring that weighs them, what each one feeds the solution,
  // and the escape to a configuration built from hand-picked pipelines -- which for this exercise
  // would mean rebuilding by hand the very pipeline that makes it work. Its one test and its judge
  // are written for it when the language is chosen (DEC-141), so there is nothing left to ask.
  // The operator's call, and he asked the right question about the advanced tab too.
  const advancedTab = !dataOnly && (isAdvanced || !readOnly);
  const tabs: PageTab[] = [
    { id: "languages", label: t("environments.title") },
    ...(dataOnly ? [] : [{ id: "tests", label: t("tests.title") }]),
    ...(advancedTab ? [{ id: "advanced", label: t("tabs.advanced") }] : []),
  ];
  const current = tabs.some((tab) => tab.id === query.tab) ? query.tab! : "languages";

  return (
    <PageShell
      title={t("title")}
      subtitle={exercise.name}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href={`/exercises/${exerciseId}/edit`} className={buttonClasses("outline", "sm")}>
            {t("settings")}
          </Link>
          <Link
            href={`/exercises/${exerciseId}/edit-limits`}
            className={buttonClasses("outline", "sm")}
          >
            {t("limits")}
          </Link>
          <Link href={`/exercises/${exerciseId}`} className={buttonClasses("outline", "sm")}>
            <BackIcon />
            {t("backToExercise")}
          </Link>
        </div>
      }
      tabs={
        <PageTabs
          basePath={`/exercises/${exerciseId}/edit-config`}
          tabs={tabs}
          current={current}
          label={t("tabs.label")}
        />
      }
    >
      <div className="flex flex-col gap-10">
        {/* **The same banner as the settings screen, from the same strings.** It used to have a
            title of its own saying the same thing in slightly different words, and the two then
            drifted apart -- the operator read one sentence here and another there and reported it
            twice. Each reason links to the tab that answers it. */}
        {exercise.isBroken && (
          <section
            aria-labelledby="config-broken"
            className="rounded-lg border border-destructive bg-destructive-surface p-4 text-sm"
          >
            <h2 id="config-broken" className="font-medium">
              {tExercise("broken.title")}
            </h2>
            <p className="mt-1 text-muted-foreground">{tExercise("broken.explain")}</p>
            <ul className="mt-2 list-disc pl-5">
              {exercise.validationErrors.map((error) => (
                <li key={error}>
                  {validationErrorHref(error, exerciseId) === null ? (
                    describeValidationError(error, tExercise)
                  ) : (
                    <Link
                      href={validationErrorHref(error, exerciseId)!}
                      className="underline underline-offset-4 hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {describeValidationError(error, tExercise)}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {exercise.archivedAt !== null && (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            {t("archivedNotice")}
          </p>
        )}
        {exercise.archivedAt === null && exercise.can.update !== true && (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            {t("readOnlyNotice")}
          </p>
        )}

        {current === "languages" && (
          <section aria-labelledby="config-environments" className="flex flex-col gap-3">
            <div>
              <h2 id="config-environments" className="text-base font-semibold tracking-tight">
                {t("environments.title")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("environments.explain")}</p>
            </div>
            {/* The one thing a teacher who is not teaching programming needs to know on this
                screen, and the screen is otherwise a list of compilers. Not a warning and not an
                error -- the fourth tone exists for exactly this. */}
            {!isAdvanced && (
              <p className="rounded-lg border border-info bg-info-surface p-4 text-sm">
                <strong className="font-semibold">{t("environments.tipTitle")}</strong>{" "}
                {t("environments.tip")}
              </p>
            )}
            {isAdvanced ? (
              <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                {t("advanced.environments")}
              </p>
            ) : (
              <EnvironmentsForm
                exerciseId={exerciseId}
                available={data.availableEnvironments}
                selected={environmentIds}
                readOnly={readOnly}
              />
            )}
          </section>
        )}

        {current === "tests" && !dataOnly && (
          <section aria-labelledby="config-tests" className="flex flex-col gap-3">
            <div>
              <h2 id="config-tests" className="text-base font-semibold tracking-tight">
                {t("tests.title")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("tests.explain")}</p>
            </div>
            {/* Keyed by what core-api holds. Saving tests **changes their ids** -- core-api copies a
              renamed test rather than updating it -- and a form still bound to the ids it mounted
              with would send `id: null` for tests that exist, which core-api refuses as a name
              already taken. Found by T-025's spec saving this form twice in a row. */}
            <TestsForm
              key={`${data.score?.calculator ?? "uniform"}:${data.tests.map((test) => test.id).join(",")}`}
              exerciseId={exerciseId}
              tests={data.tests}
              calculator={data.score?.calculator ?? "uniform"}
              weights={weights}
              equivalentWeights={equivalentWeights}
              readOnly={readOnly}
            />
          </section>
        )}

        {/* **The expression editor is not a section of its own any more.** It is what the third
            way of scoring an exercise *is*, so it appears under the choice that selects it and
            nowhere else -- and without a heading, because a heading here would announce a setting
            the reader has already chosen two paragraphs above. The tests keep the section; this is
            the rest of the same answer. */}
        {current === "tests" && !dataOnly && data.score?.calculator === "universal" && (
          <section aria-label={tScore("title")} className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{tScore("explain")}</p>
            {/* Keyed by what core-api holds, so switching onto the expression -- or saving one --
              re-seeds the field from the tree that was actually stored, rather than leaving the
              editor showing the state it mounted with. Same reason T-016's and T-024's editors are
              keyed; a text field seeded once from a prop is otherwise a stale copy after any save. */}
            <ScoreExpressionEditor
              key={`${data.score?.calculator ?? "uniform"}:${JSON.stringify(data.score?.config ?? null)}`}
              exerciseId={exerciseId}
              /* Only the universal calculator's `config` is an expression tree; the weighted one's
               is `{testWeights}`, and handing that to the printer is how this page crashed once. */
              expression={storedExpression}
              testNames={data.tests.map((test) => test.name)}
              readOnly={readOnly}
            />
          </section>
        )}

        {/* **Whose tab this is depends on which editor it renders.** The standard per-test form is
            what the tests tab is for; the advanced editor *is* the advanced tab, and leaving it
            under Tests would have meant a teacher who switched to it landing on a tab that no
            longer had anything of theirs on it. */}
        {!dataOnly && (isAdvanced ? current === "advanced" : current === "tests") && (
          <section aria-labelledby="config-tests-config" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="config-tests-config" className="text-base font-semibold tracking-tight">
                  {t("config.title")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("config.explain")}</p>
              </div>
              {/* The help sits on the section it explains rather than in a menu somewhere: this is
                  the screen a teacher meets first and understands last, and the document is what
                  the operator asked for after watching one be filled in. */}
              {help !== null && (
                <HelpDialog title={t("config.title")}>
                  <Markdown source={help} />
                </HelpDialog>
              )}
            </div>
            {isAdvanced ? (
              /* Keyed by the two structural choices. Saving either the language or the pipeline
               list rebuilds the configuration on core-api's side, so the editor has to re-seed
               from what came back rather than keep the state it was holding -- the same reason
               T-016's structure editor is keyed by its pipeline's version. Saving the *values*
               leaves the key alone, so nothing that was just typed is thrown away. */
              <AdvancedConfigEditor
                key={`${advancedEnvironment ?? ""}:${advancedPipelines.join(",")}`}
                exerciseId={exerciseId}
                isAdvanced
                values={advancedValues}
                testNames={testNames}
                pipelines={data.pipelines.map((pipeline) => ({
                  id: pipeline.id,
                  name: pipeline.name,
                  environments: pipeline.runtimeEnvironmentIds,
                }))}
                chosenPipelines={advancedPipelines}
                environments={data.availableEnvironments}
                environmentId={advancedEnvironment}
                environmentVariables={data.environments[0]?.variablesTable ?? []}
                suggestedVariables={possibleEnvironmentVariables(
                  data.pipelineVariables,
                  advancedPipelines,
                )}
                readOnly={readOnly}
              />
            ) : data.configRefused ? (
              <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                {t("config.refused")}
              </p>
            ) : data.tests.length === 0 || environmentIds.length === 0 ? (
              <div className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
                <p>{t("config.unavailable")}</p>
                <ul className="mt-2 list-disc pl-5">
                  {data.tests.length === 0 && <li>{t("config.noTests")}</li>}
                  {environmentIds.length === 0 && <li>{t("config.noEnvironments")}</li>}
                </ul>
              </div>
            ) : (
              <>
                {capabilities.withoutPipelines.length > 0 && (
                  <p className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
                    {t("config.noPipelines", {
                      environments: capabilities.withoutPipelines
                        .map((id) => environmentNames[id] ?? id)
                        .join(", "),
                    })}
                  </p>
                )}
                <TestConfigForm
                  exerciseId={exerciseId}
                  values={values}
                  testNames={testNames}
                  environments={environmentIds}
                  environmentNames={environmentNames}
                  capabilities={capabilities}
                  files={exercise.files.map((file) => file.name)}
                  readOnly={readOnly}
                />
              </>
            )}
          </section>
        )}

        {current === "advanced" && !isAdvanced && !readOnly && (
          <section aria-labelledby="config-kind" className="flex flex-col gap-3">
            <div>
              <h2 id="config-kind" className="text-base font-semibold tracking-tight">
                {tAdvanced("toAdvanced.title")}
              </h2>
            </div>
            <AdvancedConfigEditor
              exerciseId={exerciseId}
              isAdvanced={false}
              values={null}
              testNames={testNames}
              pipelines={[]}
              chosenPipelines={[]}
              environments={data.availableEnvironments}
              environmentId={environmentIds[0] ?? null}
              environmentVariables={[]}
              suggestedVariables={{}}
              readOnly={readOnly}
            />
          </section>
        )}
      </div>
    </PageShell>
  );
}
