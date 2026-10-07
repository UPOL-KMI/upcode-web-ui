import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { getGroupStudents } from "@/lib/api/group-detail";
import { getShadowAssignment } from "@/lib/api/shadow-assignment";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";
import { formatPoints } from "@/lib/format/points";

import { Link } from "@/i18n/navigation";
import { ShadowPointsTable } from "@/components/assignments/shadow-points-table";
import { DateTime } from "@/components/format/date-time";
import { Markdown } from "@/components/markdown/markdown";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/status/badge";
import { buttonClasses } from "@/components/button";
import { BackIcon, PencilIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Shadow" });
  return { title: t("title") };
}

/**
 * A shadow assignment (S-020) -- work ReCodEx does not evaluate, whose points a teacher awards by
 * hand: an oral exam, a presentation, attendance.
 *
 * Everything unusual about this screen follows from there being **nothing to submit**. There is no
 * "submit" action, no evaluation, no attempts; the deadline is stated as informative, in those
 * words, because core-api's own documentation says the supervisor decides whether it was breached;
 * and the points are records with an author and a note rather than a computed score.
 *
 * Who sees whose points is core-api's answer, not this page's: a reader with `viewAllPoints` gets
 * every record in the response, a student gets only their own, so the same component renders both
 * without a branch that could disagree with the API.
 */
export default async function ShadowAssignmentPage({
  params,
}: {
  params: Promise<{ shadowId: string }>;
}) {
  const [{ shadowId }, locale] = await Promise.all([params, getLocale()]);
  const [t, assignment] = await Promise.all([
    getTranslations("Shadow"),
    getShadowAssignment(shadowId, locale),
  ]);
  const breadcrumbs = await resolveBreadcrumbs(`/shadow-assignments/${shadowId}`, locale);
  const canSeeEveryone = assignment.can.viewAllPoints === true;

  // **The table has a row per student of the group**, graded or not (DEC-166) -- and only they
  // can be awarded: core-api refuses anybody else with "User is not member of the group". Read
  // for whoever sees every record, which is who the table is for.
  const roster =
    canSeeEveryone && assignment.groupId ? await getGroupStudents(assignment.groupId) : [];

  return (
    <PageShell
      title={assignment.name || t("untitled")}
      subtitle={assignment.groupName}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {assignment.isBonus && <Badge tone="info">{t("flags.bonus")}</Badge>}
          {!assignment.isPublic && <Badge tone="warning">{t("flags.hidden")}</Badge>}
          {assignment.groupId && (
            <Link
              href={`/groups/${assignment.groupId}?tab=assignments`}
              className={buttonClasses("outline", "sm")}
            >
              <BackIcon />
              {t("backToGroup")}
            </Link>
          )}
          {assignment.can.update === true && (
            <Link
              href={`/shadow-assignments/${shadowId}/edit`}
              className={buttonClasses("warning-outline", "sm")}
            >
              <PencilIcon />
              {t("editLink")}
            </Link>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-8">
        <section aria-labelledby="shadow-text">
          <h2 id="shadow-text" className="mb-3 text-base font-semibold tracking-tight">
            {t("description")}
          </h2>
          {assignment.text ? (
            <Markdown source={assignment.text} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("noDescription")}</p>
          )}
        </section>

        <section aria-labelledby="shadow-terms">
          <h2 id="shadow-terms" className="mb-3 text-base font-semibold tracking-tight">
            {t("terms")}
          </h2>
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b border-border py-2">
              <dt className="text-sm text-muted-foreground">{t("maxPoints")}</dt>
              <dd className="text-sm font-medium tabular-nums">{assignment.maxPoints}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border py-2">
              <dt className="text-sm text-muted-foreground">{t("deadline")}</dt>
              <dd className="text-sm">
                {assignment.deadline !== null ? (
                  <DateTime unixSeconds={assignment.deadline} />
                ) : (
                  <span className="text-muted-foreground">{t("noDeadline")}</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border py-2">
              <dt className="text-sm text-muted-foreground">{t("bonus")}</dt>
              <dd className="text-sm">{assignment.isBonus ? t("yes") : t("no")}</dd>
            </div>
            {canSeeEveryone && (
              <div className="flex justify-between gap-4 border-b border-border py-2">
                <dt className="text-sm text-muted-foreground">{t("visibility")}</dt>
                <dd className="text-sm">
                  {assignment.isPublic ? t("visible") : t("hiddenFromStudents")}
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">{t("deadlineNote")}</p>
        </section>

        {!canSeeEveryone && (
          <section aria-labelledby="shadow-my-points">
            <h2 id="shadow-my-points" className="mb-3 text-base font-semibold tracking-tight">
              {t("myPoints")}
            </h2>
            {assignment.myPoints ? (
              <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                <div className="flex justify-between gap-4 border-b border-border py-2">
                  <dt className="text-sm text-muted-foreground">{t("points.columns.points")}</dt>
                  <dd className="text-sm font-medium tabular-nums">
                    {formatPoints(assignment.myPoints.points, assignment.maxPoints)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border py-2">
                  <dt className="text-sm text-muted-foreground">{t("points.columns.awardedAt")}</dt>
                  <dd className="text-sm">
                    {assignment.myPoints.awardedAt !== null ? (
                      <DateTime unixSeconds={assignment.myPoints.awardedAt} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>
                {assignment.myPoints.note && (
                  <div className="flex justify-between gap-4 border-b border-border py-2 sm:col-span-2">
                    <dt className="text-sm text-muted-foreground">{t("points.columns.note")}</dt>
                    <dd className="text-sm">{assignment.myPoints.note}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noPointsYet")}</p>
            )}
          </section>
        )}

        {canSeeEveryone && (
          <section aria-labelledby="shadow-points">
            <h2 id="shadow-points" className="mb-3 text-base font-semibold tracking-tight">
              {t("points.title")}
            </h2>
            <ShadowPointsTable
              shadowId={shadowId}
              points={assignment.points}
              students={roster.map((student) => ({ id: student.id, name: student.fullName }))}
              maxPoints={assignment.maxPoints}
              can={{
                create: assignment.can.createPoints === true,
                update: assignment.can.updatePoints === true,
                remove: assignment.can.removePoints === true,
              }}
            />
          </section>
        )}
      </div>
    </PageShell>
  );
}
