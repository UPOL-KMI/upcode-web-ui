import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/api/current-user";
import { getGroupDetail } from "@/lib/api/group-detail";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";
import { ImportRosterForm } from "@/components/users/import-roster-form";
import { buttonClasses } from "@/components/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("UserImport");
  return { title: t("title") };
}

/**
 * Importing a list of people (AD-009, reopened by X-015).
 *
 * **Two screens sharing a route, gated differently, because they are different powers.**
 *
 * `?group=` puts everyone invited straight into that group, and that is the ordinary case: a
 * cohort imported into the course it studies. It is offered on `permissionHints.inviteStudents`
 * -- core-api's own answer, computed for the group by `PermissionHints::get` because
 * `canInviteStudents(Group)` takes a single argument. So a cvičící who may invite people into
 * their own course may import a list of them, which is the same act done a hundred times. The
 * operator found the old gate by asking the obvious question: how is a teacher supposed to get
 * students in, when the students do not have accounts yet?
 *
 * Without `?group=` it is an import into the instance at large, with nothing scoping it, and that
 * stays the superadmin's. DEC-110 is the reason the two cannot be gated the same way: a *user*
 * carries no permission hints, so there is nothing to ask about "may this person invite anybody at
 * all" -- only about a particular group.
 *
 * Archived and organizational groups are refused here as well as by core-api
 * (`RegistrationPresenter.php:308`), so the screen does not open onto an import that every row
 * would fail.
 */
export default async function ImportUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const [{ group }, locale, viewer] = await Promise.all([
    searchParams,
    getLocale(),
    getCurrentUser(),
  ]);

  const groupDetail = group === undefined ? null : await getGroupDetail(group, locale);
  const mayImportHere =
    groupDetail !== null &&
    groupDetail.can.inviteStudents === true &&
    !groupDetail.archived &&
    !groupDetail.organizational;

  if (viewer.role !== "superadmin" && !mayImportHere) forbidden();

  const [t, breadcrumbs] = await Promise.all([
    getTranslations("UserImport"),
    resolveBreadcrumbs("/users/import", locale),
  ]);

  return (
    <PageShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={breadcrumbs}
      actions={
        <Link href="/users" className={buttonClasses("outline", "sm")}>
          {t("backToUsers")}
        </Link>
      }
    >
      <ImportRosterForm groupId={group} groupName={groupDetail?.name} />
    </PageShell>
  );
}
