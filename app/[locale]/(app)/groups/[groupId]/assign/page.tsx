import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { canSeeExerciseSection, getCurrentUser } from "@/lib/api/current-user";
import { getAssignableExercises } from "@/lib/api/exercises";
import { getGroupDetail } from "@/lib/api/group-detail";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { ExercisePicker } from "@/components/assignments/exercise-picker";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";
import { buttonClasses } from "@/components/button";
import { BackIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AssignExercise" });
  return { title: t("title") };
}

/**
 * Assigning an exercise to a group (T-001) -- the step before T-002's settings, and the only way
 * an assignment comes into existence.
 *
 * **The search is a server round trip, not `DataTable`'s client-side filter.** The catalog is the
 * one list in this app that genuinely is not fetched whole: `/v1/exercises` is paginated and an
 * instance can hold thousands, so the query goes to core-api (which accepts `search`) and the
 * result says how many matched in total. That is the opposite trade from S-004's group list, and
 * deliberately: the difference is whether "everything" is a number you can hold.
 *
 * Gated on the **group's** `assignExercise`, checked here: the group's own detail is a permitted
 * read for its students, so `apiRead`'s 403 would never fire -- the same trap T-002 fell into and
 * DEC-092 records. Each row is then gated again on the exercise's own `assign`.
 */
export default async function AssignExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ q?: string; scope?: string }>;
}) {
  const [{ groupId }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const [t, group, user] = await Promise.all([
    getTranslations("AssignExercise"),
    getGroupDetail(groupId, locale),
    getCurrentUser(),
  ]);

  if (group.can.assignExercise !== true || group.organizational) forbidden();

  const search = (query.q ?? "").trim();
  // The group's own pool by default (G-010), the whole instance catalog on request. A teacher
  // assigning work reaches for a course's own exercises far more often than for everything the
  // instance holds, and until this ticket the picker started from everything with no way to say
  // otherwise. In the URL, so a narrowed picker can be linked to and survives a reload.
  const wholeCatalog = query.scope === "all";
  const [{ exercises, totalCount }, breadcrumbs] = await Promise.all([
    getAssignableExercises(locale, search, wholeCatalog ? null : groupId),
    resolveBreadcrumbs(`/groups/${groupId}/assign`, locale),
  ]);

  const scopeHref = (scope: "group" | "all") => {
    const params = new URLSearchParams();
    if (search !== "") params.set("q", search);
    if (scope === "all") params.set("scope", "all");
    const qs = params.toString();
    return `/groups/${groupId}/assign${qs === "" ? "" : `?${qs}`}`;
  };

  return (
    <PageShell
      title={t("title")}
      subtitle={group.name}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/groups/${groupId}?tab=assignments`}
            className={buttonClasses("outline", "sm")}
          >
            <BackIcon />
            {t("backToGroup")}
          </Link>
          {/* The way out of "nothing here to assign": this page only picks from what the catalog
              already holds, and a teacher who needs a new exercise has to leave it. Gated on the
              same predicate as the sidebar section (G-010) rather than shown to everyone who got
              here -- `exercise.viewAll` starts at `supervisor-student`, and offering a link that
              answers 403 is the fault the sidebar was fixed for. */}
          {canSeeExerciseSection(user.role) && (
            <Link href="/exercises" className={buttonClasses("primary", "sm")}>
              {t("manageCatalog")}
            </Link>
          )}
        </div>
      }
    >
      <div className="flex max-w-3xl flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("explain")}</p>

        <nav aria-label={t("scopeLabel")} className="flex flex-wrap gap-2">
          {(["group", "all"] as const).map((scope) => {
            const active = scope === (wholeCatalog ? "all" : "group");
            return (
              <Link
                key={scope}
                href={scopeHref(scope)}
                aria-current={active ? "true" : undefined}
                className={`rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                  active
                    ? "border-primary bg-primary/10 font-medium"
                    : "border-input hover:bg-muted"
                }`}
              >
                {t(`scope.${scope}`)}
              </Link>
            );
          })}
        </nav>

        <form method="get" className="flex flex-wrap gap-2">
          {wholeCatalog && <input type="hidden" name="scope" value="all" />}
          <input
            type="search"
            name="q"
            defaultValue={search}
            aria-label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button type="submit" className={buttonClasses("outline", "sm")}>
            {t("search")}
          </button>
        </form>

        {exercises.length === 0 ? (
          <EmptyState
            title={t("empty.title")}
            description={
              search !== ""
                ? t("empty.noMatch")
                : wholeCatalog
                  ? t("empty.description")
                  : t("empty.groupPool")
            }
            action={
              !wholeCatalog ? (
                <Link href={scopeHref("all")} className={buttonClasses("outline", "sm")}>
                  {t("scope.all")}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <ExercisePicker exercises={exercises} groupId={groupId} />
            {totalCount > exercises.length && (
              <p className="text-xs text-muted-foreground">
                {t("more", { shown: exercises.length, total: totalCount })}
              </p>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
