import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getExerciseAssignments } from "@/lib/api/exercise-assignments";
import { getExerciseDetail } from "@/lib/api/exercise-detail";
import { getGroupList, getMyGroups } from "@/lib/api/groups";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
import { isDataOnly } from "@/lib/status/exercise-validation";

import { Link } from "@/i18n/navigation";
import { AssignToGroups } from "@/components/exercises/exercise-assignments";
import { DateTime } from "@/components/format/date-time";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/status/badge";
import { buttonClasses } from "@/components/button";
import { BackIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ExerciseAssignments" });
  return { title: t("title") };
}

/**
 * The assignments made from one exercise (T-012) -- the legacy
 * `/app/exercises/:id/assignments` route.
 *
 * T-021 counts them, which is what says the exercise is in use; this is the list behind that
 * number, and it exists because **an assignment is a snapshot**. Editing an exercise does not
 * change anything already assigned from it, so after a round of edits the question a teacher has
 * is "who is now out of date" -- and answering it otherwise means opening every assignment in
 * turn. Each row says which parts have drifted, read through the same rule S-013's notice uses;
 * re-synchronising stays on the assignment's own settings screen (T-002), where the button that
 * does it already lives.
 *
 * **Assigning to several groups at once** is the legacy screen's other half. core-api has no bulk
 * call, so it is one request per group and each one succeeds or fails on its own -- a reader who
 * may create in four of five groups they picked gets four assignments and one named refusal.
 *
 * `viewAssignments` gates the reading; creating is the destination group's rule, which no hint on
 * the exercise expresses (DEC-090's shape), so the offer is the groups the reader teaches -- less
 * the organizational ones, which core-api refuses outright -- and core-api decides for real.
 */
export default async function ExerciseAssignmentsPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const [{ exerciseId }, locale] = await Promise.all([params, getLocale()]);
  const [t, exercise] = await Promise.all([
    getTranslations("ExerciseAssignments"),
    getExerciseDetail(exerciseId, locale),
  ]);

  if (exercise.can.viewAssignments !== true) forbidden();

  const [assignments, mine, allGroups, breadcrumbs] = await Promise.all([
    getExerciseAssignments(exerciseId, locale),
    getMyGroups(locale),
    // For the ancestry, and for nothing else: the offer is still the reader's own teaching groups.
    // Both calls read the same memoized response, so this costs no extra round trip.
    getGroupList(locale),
    resolveBreadcrumbs(`/exercises/${exerciseId}/assignments`, locale),
  ]);

  const alreadyAssigned = new Set(assignments.map((assignment) => assignment.groupId));
  // **An organizational group can never take an assignment** -- core-api answers "You cannot assign
  // exercises in organizational groups" (a 400, measured) -- so offering one is an offer that
  // cannot succeed, which brief §3.4 rules out. The reader's containers were half the list on the
  // operator's own instance, where a course is a tree and only its leaves hold students. Taken
  // from the group list rather than filtered in place, because that list is already in tree order
  // and carries each group's ancestry, which is what the offer is drawn from.
  const teaching = new Set(mine.teaching.map((group) => group.id));
  const assignable = allGroups
    .filter((group) => teaching.has(group.id) && !group.organizational)
    .map((group) => ({ id: group.id, name: group.name, path: group.path }));

  // A data-only exercise is exempt from the reference solution (DEC-141) -- it runs none of the
  // student's code, so there is no automatic verdict a reference solution could vouch for. The
  // order matters: report what a teacher can act on first.
  const blockedReason: "reasonLocked" | "reasonBroken" | "reasonNoReference" | null =
    exercise.isLocked
      ? "reasonLocked"
      : exercise.isBroken
        ? "reasonBroken"
        : !isDataOnly(exercise.environments.map((environment) => environment.id)) &&
            !exercise.hasReferenceSolutions
          ? "reasonNoReference"
          : null;

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
        <section aria-labelledby="exercise-assignment-list" className="flex flex-col gap-3">
          <div>
            <h2 id="exercise-assignment-list" className="text-base font-semibold tracking-tight">
              {t("list.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("list.explain")}</p>
          </div>

          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("list.none")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("list.group")}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("list.deadline")}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("list.points")}
                    </th>
                    <th scope="col" className="py-1 font-medium">
                      {t("list.state")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b border-border/50">
                      <td className="py-2 pr-3">
                        <Link
                          href={`/assignments/${assignment.id}`}
                          className="text-primary underline underline-offset-2"
                        >
                          {assignment.groupName ?? t("list.hiddenGroup")}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {assignment.name}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <DateTime unixSeconds={assignment.firstDeadline} />
                      </td>
                      <td className="py-2 pr-3">{assignment.maxPoints}</td>
                      <td className="py-2">
                        <span className="flex flex-wrap gap-1">
                          {!assignment.isPublic && (
                            <Badge tone="neutral">{t("list.invisible")}</Badge>
                          )}
                          {assignment.staleParts.length > 0 && (
                            <Badge tone="warning">
                              {t("list.stale", { count: assignment.staleParts.length })}
                            </Badge>
                          )}
                          {assignment.staleParts.length === 0 && assignment.isPublic && (
                            <Badge tone="success">{t("list.current")}</Badge>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="exercise-assign" className="flex flex-col gap-3">
          <div>
            <h2 id="exercise-assign" className="text-base font-semibold tracking-tight">
              {t("assign.title")}
            </h2>
          </div>
          {/* **The same four conditions core-api checks**, not just `isBroken`. This screen used to
              ask only whether the configuration was finished, so an exercise with no reference
              solution was offered the whole picker and refused by core-api afterwards in English.
              The exercise catalog's own picker (T-001) has had the full test all along; this is the
              second door into the same action and it was not locked. Reported by the operator, who
              had set up a Python exercise's tests and limits and was offered the form for it. */}
          {blockedReason !== null ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-warning bg-warning-surface p-4 text-sm">
              <p>{t("assign.blocked", { reason: t(`assign.${blockedReason}`) })}</p>
              {blockedReason === "reasonNoReference" && (
                <Link
                  href={`/exercises/${exerciseId}/reference-solutions`}
                  className={buttonClasses("outline", "sm")}
                >
                  {t("assign.toReference")}
                </Link>
              )}
            </div>
          ) : (
            <AssignToGroups
              exerciseId={exerciseId}
              groups={assignable}
              alreadyAssigned={alreadyAssigned}
            />
          )}
        </section>
      </div>
    </PageShell>
  );
}
