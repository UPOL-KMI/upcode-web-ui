import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getExerciseDetail } from "@/lib/api/exercise-detail";
import { getReferenceSolutions } from "@/lib/api/reference-solutions";
import { getRuntimeEnvironments } from "@/lib/api/runtime-environments";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
import { getHelp } from "@/lib/docs/guides";

import { Link } from "@/i18n/navigation";
import { SubmitReferenceSolution } from "@/components/exercises/reference-solution-submit";
import { ReferenceSolutionsTable } from "@/components/exercises/reference-solutions-table";
import { HelpDialog } from "@/components/help/help-dialog";
import { Markdown } from "@/components/markdown/markdown";
import { PageShell } from "@/components/page-shell";
import { buttonClasses } from "@/components/button";
import { BackIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ReferenceSolutions" });
  return { title: t("title") };
}

/**
 * An exercise's reference solutions (T-011) -- the legacy
 * `/app/exercises/:id/reference-solutions` route.
 *
 * A reference solution is the author's own answer, run through the very pipeline a student's would
 * be. It is what **proves the exercise is possible**, and core-api treats it that way: an exercise
 * with none cannot be assigned at all. That refusal appears in no list payload, which is why
 * T-001's picker could only meet it on the attempt (DEC-097's fifth reason) -- and why this screen
 * is where it gets answered.
 *
 * The results table is literally S-015's, because a reference evaluation is not a special kind of
 * run: it is this exercise's own configuration executed for real. What is different is what the
 * numbers mean -- there are no points here, only whether the tests passed, so the screen reports
 * the state and not a score.
 *
 * **The list is filtered one solution at a time**, so it being empty does not mean the exercise
 * has none -- a colleague's private answers are simply absent. The exercise's own
 * `hasReferenceSolutions` is what tells the two apart, and the empty state says which it is.
 *
 * **This deployment cannot produce a real pass or fail** (DEC-031: cgroup v2 only), so every
 * reference solution here reports an infrastructure failure. The states other than "failed" have
 * never been rendered with data on this machine.
 */
export default async function ReferenceSolutionsPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const [{ exerciseId }, locale] = await Promise.all([params, getLocale()]);
  const [t, exercise] = await Promise.all([
    getTranslations("ReferenceSolutions"),
    getExerciseDetail(exerciseId, locale),
  ]);

  // Reading an exercise does not entitle anybody to its answers.
  if (exercise.can.viewDetail !== true) forbidden();

  const [solutions, environments, help, breadcrumbs] = await Promise.all([
    getReferenceSolutions(exerciseId),
    getRuntimeEnvironments(),
    getHelp("reference-solutions", locale),
    resolveBreadcrumbs(`/exercises/${exerciseId}/reference-solutions`, locale),
  ]);

  const canAdd = exercise.can.addReferenceSolution === true && exercise.archivedAt === null;
  const environmentNames = Object.fromEntries(
    environments.map((environment) => [environment.id, environment.name]),
  );

  return (
    <PageShell
      title={t("title")}
      subtitle={exercise.name}
      breadcrumbs={breadcrumbs}
      actions={
        <Link href={`/exercises/${exerciseId}`} className={buttonClasses("outline", "sm")}>
          <BackIcon />
          {t("backToExercise")}
        </Link>
      }
    >
      <div className="flex flex-col gap-10">
        <section aria-labelledby="reference-solution-list" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="reference-solution-list" className="text-base font-semibold tracking-tight">
                {t("list.title")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("list.explain")}</p>
            </div>
            {help !== null && (
              <HelpDialog title={t("title")}>
                <Markdown source={help} />
              </HelpDialog>
            )}
          </div>
          <ReferenceSolutionsTable
            exerciseId={exerciseId}
            solutions={solutions}
            canResubmitAll={canAdd && solutions.length > 0}
            someAreHidden={solutions.length === 0 && exercise.hasReferenceSolutions}
          />
        </section>

        {canAdd && (
          <section aria-labelledby="reference-solution-submit" className="flex flex-col gap-3">
            <h2 id="reference-solution-submit" className="text-base font-semibold tracking-tight">
              {t("submit.title")}
            </h2>
            <SubmitReferenceSolution exerciseId={exerciseId} environmentNames={environmentNames} />
          </section>
        )}
      </div>
    </PageShell>
  );
}
