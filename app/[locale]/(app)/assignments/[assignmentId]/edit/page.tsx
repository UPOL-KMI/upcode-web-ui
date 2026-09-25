import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getAssignmentSettings } from "@/lib/api/assignment-edit";
import { getExerciseName } from "@/lib/api/exercise-detail";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { AssignmentTextsForm } from "@/components/assignments/assignment-texts-form";
import { DeleteAssignment } from "@/components/assignments/delete-assignment";
import { PageShell } from "@/components/page-shell";
import { PageTabs, type PageTab } from "@/components/page-tabs";
import { buttonClasses } from "@/components/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AssignmentEdit" });
  return { title: t("title") };
}

/**
 * An assignment's settings (T-002): when it is due, what it is worth, how often it may be
 * attempted, and how much of the evaluation a student is shown.
 *
 * **Not the exercise.** What is asked here is everything the *assignment* owns; the tests and the
 * limits belong to the exercise it was copied from, and changing those is T-008/T-010's screen
 * followed by the re-sync this ticket added to S-013's notice. The **text** is the one thing that
 * can be either: the assignment holds a copy, and G-007's second form overrides it for this class
 * alone, at the cost of a re-sync putting the exercise's back.
 *
 * **The refusal has to be an explicit check here, not `apiRead`'s.** Reading an assignment is
 * something a student may do -- it is their own assignment -- so the fetch this page makes
 * succeeds for them and only the *save* would be refused. Found by the spec: without this, a
 * student who guessed the URL was handed a filled-in settings form that core-api would reject on
 * submit. `update` is the hint the link is offered on, so the page asks the same question.
 */
export default async function EditAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ assignmentId }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const [t, assignment] = await Promise.all([
    getTranslations("AssignmentEdit"),
    getAssignmentSettings(assignmentId, locale, routing.locales),
  ]);
  if (assignment.can.update !== true) forbidden();

  const [breadcrumbs, exerciseName] = await Promise.all([
    resolveBreadcrumbs(`/assignments/${assignmentId}/edit`, locale),
    // Named in the re-sync dialog the texts form opens; `null` for an exercise since deleted.
    assignment.exerciseId === null ? null : getExerciseName(assignment.exerciseId, locale),
  ]);

  // **Four tabs over two forms**, which is why the panels are hidden rather than unrendered: the
  // text has its own save, everything else shares one, and a teacher who fills in a deadline and
  // then looks at the visibility must not come back to an empty field. Sections the operator did
  // not name are folded into the tab they belong with -- what a student may submit sits with the
  // deadlines and points that govern it, and what a student may see of the evaluation with the
  // rest of the visibility.
  const tabs: PageTab[] = [
    { id: "texts", label: t("tabs.texts") },
    { id: "visibility", label: t("tabs.visibility") },
    { id: "deadlines", label: t("tabs.deadlines") },
    { id: "hints", label: t("tabs.hints") },
  ];
  const current = tabs.some((tab) => tab.id === query.tab) ? query.tab! : "texts";

  return (
    <PageShell
      title={t("title")}
      subtitle={assignment.name}
      breadcrumbs={breadcrumbs}
      actions={
        <Link href={`/assignments/${assignmentId}`} className={buttonClasses("outline", "sm")}>
          {t("backToAssignment")}
        </Link>
      }
      tabs={
        <PageTabs
          basePath={`/assignments/${assignmentId}/edit`}
          tabs={tabs}
          current={current}
          label={t("tabs.label")}
        />
      }
    >
      <div className="flex max-w-3xl flex-col gap-10">
        <AssignmentTextsForm
          assignment={assignment}
          exerciseName={exerciseName}
          hidden={current !== "texts"}
        />
        <AssignmentForm assignment={assignment} activeTab={current} />
        {/* Deleting is not one of the four subjects; it is what to do with the whole assignment,
            so it stays below them rather than hiding on one. */}
        {assignment.can.remove === true && (
          <DeleteAssignment assignmentId={assignment.id} groupId={assignment.groupId} />
        )}
      </div>
    </PageShell>
  );
}
