import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getExerciseDetail } from "@/lib/api/exercise-detail";
import { getMyGroups } from "@/lib/api/groups";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { routing } from "@/i18n/routing";

import { Link } from "@/i18n/navigation";
import { ExerciseControls } from "@/components/exercises/exercise-controls";
import { ExerciseFiles } from "@/components/exercises/exercise-files";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { ExercisePeople } from "@/components/exercises/exercise-people";
import { PageShell } from "@/components/page-shell";
import { PageTabs, type PageTab } from "@/components/page-tabs";
import {
  describeValidationError,
  isDataOnly,
  validationErrorHref,
} from "@/lib/status/exercise-validation";
import { buttonClasses } from "@/components/button";
import { BackIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ExerciseEdit" });
  return { title: t("title") };
}

/**
 * An exercise's basic settings (T-008) -- the legacy `/app/exercises/:id/edit` route, and where
 * creating one lands.
 *
 * **The page asks `update` itself rather than relying on `apiRead`'s 403.** Reading an exercise is
 * something any teacher may do, so the fetch succeeds for someone who may not change it and only
 * the save would be refused -- the same trap T-002 fell into and DEC-092 records. Being handed a
 * filled-in form for something you may not touch is its own defect.
 *
 * An **archived** exercise is frozen: core-api refuses to update it, so the form is not rendered
 * for one at all rather than rendered and refused on submit (S-009's rule for an archived group).
 * Unarchiving is still offered, and is the way back.
 *
 * T-023 added the three things this screen deliberately stopped short of: the exercise's own
 * files and the named links into them, its administrators and author, and forking it into another
 * group. Each is its own call and its own section, for the reason the tags and groups above are --
 * none of them is a field of the settings save. The tests (T-009), the limits (T-010) and the
 * reference solutions (T-011) are their own screens by the backlog's own plan.
 */
export default async function EditExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ exerciseId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ exerciseId }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const [t, tExercise, exercise] = await Promise.all([
    getTranslations("ExerciseEdit"),
    getTranslations("Exercise"),
    getExerciseDetail(exerciseId, locale),
  ]);

  // Any one of the three things this screen can do -- S-009's rule for the group settings tab, and
  // for the same reason it was needed there: **archiving an exercise takes `update` away**
  // (core-api's rule carries `exercise.notArchived`), so gating the page on `update` alone would
  // lock the reader out of the screen holding the button that undoes it. Found by this ticket's
  // own spec, which archived an exercise and was then refused the page.
  if (
    exercise.can.update !== true &&
    exercise.can.archive !== true &&
    exercise.can.remove !== true
  ) {
    forbidden();
  }

  const [mine, breadcrumbs] = await Promise.all([
    getMyGroups(locale),
    resolveBreadcrumbs(`/exercises/${exerciseId}/edit`, locale),
  ]);

  const tabs: PageTab[] = [
    { id: "settings", label: t("tabs.settings") },
    { id: "tags", label: t("tabs.tags") },
    { id: "groups", label: t("tabs.groups") },
    { id: "notify", label: t("tabs.notify") },
    { id: "files", label: t("tabs.files") },
    { id: "people", label: t("tabs.people") },
  ];
  const current = tabs.some((tab) => tab.id === query.tab) ? query.tab! : "settings";
  const readOnly = exercise.can.update !== true || exercise.archivedAt !== null;

  // Data-only exercises are exempt (DEC-141): they run none of the student's code, so there is no
  // automatic verdict for a reference solution to vouch for.
  const needsReference =
    !isDataOnly(exercise.environments.map((environment) => environment.id)) &&
    !exercise.hasReferenceSolutions;

  return (
    <PageShell
      title={t("title")}
      subtitle={exercise.name}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap gap-2">
          {/* **The two editors that are not tabs.** Everything else about an exercise is a tab on
              this screen; the tests and the limits are screens of their own (their own routes,
              their own saves) and are reached from here rather than from the exercise itself,
              where they crowded out the exercise. Each is offered only where core-api's own hint
              says it would open. */}
          {exercise.can.viewConfig === true && (
            <Link
              href={`/exercises/${exerciseId}/edit-config`}
              className={buttonClasses("outline", "sm")}
            >
              {tExercise("configure")}
            </Link>
          )}
          {exercise.can.viewLimits === true && (
            <Link
              href={`/exercises/${exerciseId}/edit-limits`}
              className={buttonClasses("outline", "sm")}
            >
              {tExercise("limits")}
            </Link>
          )}
          <Link href={`/exercises/${exerciseId}`} className={buttonClasses("outline", "sm")}>
            <BackIcon />
            {t("backToExercise")}
          </Link>
        </div>
      }
      tabs={
        <PageTabs
          basePath={`/exercises/${exerciseId}/edit`}
          tabs={tabs}
          current={current}
          label={t("tabs.label")}
        />
      }
    >
      <div className="flex flex-col gap-8">
        {/* **Whether this exercise can be given to anybody, said once and at the top.** It is the
            question the whole screen exists to answer, and it was only visible on the exercise's
            own detail page -- so an author could fill this form in, save it, and still not know
            why the assign button was refusing them. `validationErrors` is core-api's own list of
            what is missing. */}
        {exercise.isBroken ? (
          <section
            aria-labelledby="exercise-status"
            className="rounded-lg border border-destructive bg-destructive-surface p-4 text-sm"
          >
            <h2 id="exercise-status" className="font-medium">
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
        ) : needsReference ? (
          // **"Configured" is not the same as "assignable".** core-api asks for a reference
          // solution as well, and nothing in `validationErrors` mentions it -- so this screen told
          // the operator the exercise was ready while the exercise's own screen refused to assign
          // it. The claim is now the narrower true one, with the way to finish it.
          <div className="flex flex-col items-start gap-3 rounded-lg border border-warning bg-warning-surface p-4 text-sm">
            <p>{t("status.needsReference")}</p>
            <Link
              href={`/exercises/${exerciseId}/reference-solutions`}
              className={buttonClasses("outline", "sm")}
            >
              {t("status.toReference")}
            </Link>
          </div>
        ) : (
          <p className="rounded-lg border border-success bg-success-surface p-4 text-sm">
            {t("status.assignable")}
          </p>
        )}

        {(exercise.archivedAt !== null || exercise.can.update !== true) && (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            {exercise.archivedAt !== null ? t("archivedNotice") : t("readOnlyNotice")}
          </p>
        )}

        {current === "settings" && (
          <>
            {!readOnly && <ExerciseForm exercise={exercise} locales={routing.locales} />}
            <ExercisePeople
              exercise={exercise}
              teachingGroups={mine.teaching}
              canFork={exercise.can.fork === true}
              sections={["fork"]}
            />
            <ExerciseControls
              exercise={exercise}
              teachingGroups={mine.teaching}
              sections={["lifecycle"]}
            />
          </>
        )}

        {current === "tags" && (
          <ExerciseControls
            exercise={exercise}
            teachingGroups={mine.teaching}
            sections={["tags"]}
          />
        )}

        {current === "groups" && (
          <ExerciseControls
            exercise={exercise}
            teachingGroups={mine.teaching}
            sections={["groups"]}
          />
        )}

        {current === "notify" && (
          <ExerciseControls
            exercise={exercise}
            teachingGroups={mine.teaching}
            sections={["notify"]}
          />
        )}

        {current === "files" && (
          <ExerciseFiles
            exerciseId={exerciseId}
            files={exercise.files}
            links={exercise.fileLinks}
            archiveUrl={`/api/exercises/${exerciseId}/files`}
            readOnly={readOnly}
          />
        )}

        {current === "people" && (
          <ExercisePeople
            exercise={exercise}
            teachingGroups={mine.teaching}
            canFork={exercise.can.fork === true}
            sections={["rights"]}
          />
        )}
      </div>
    </PageShell>
  );
}
