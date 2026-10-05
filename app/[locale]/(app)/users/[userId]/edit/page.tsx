import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/api/current-user";
import { getAccountSettings } from "@/lib/api/user-settings";
import { resolveBreadcrumbs } from "@/lib/breadcrumbs/manifest";

import { Link, redirect } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";
import { ProfileForm } from "@/components/users/account-forms";
import {
  AccountAccess,
  AdminPasswordForm,
  ExternalIds,
  RoleForm,
} from "@/components/users/user-admin-forms";
import { buttonClasses } from "@/components/button";
import { BackIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "UserEdit" });
  return { title: t("title") };
}

/**
 * Somebody else's account, as an administrator edits it (AD-002) -- the legacy `EditUser` page seen
 * from the half S-022 deliberately did not build.
 *
 * **Editing oneself is a different screen and this route says so.** An administrator who arrives
 * here on their own id is redirected to `/profile/edit`, which is not tidiness: core-api refuses
 * `setRole` and `setIsAllowed` on one's own account with an explicit second check, and refuses a
 * *forced* password change on oneself through an `allow: false` rule that outranks the superadmin's
 * blanket allow -- so every control this page adds would fail there, while the one thing that
 * would work (changing one's own password, knowing the old one) lives on that screen already. All
 * three verified live rather than read off `permissions.neon`.
 *
 * **Who may open it is decided here, not by core-api's refusal.** The read succeeds for any
 * supervisor -- `viewDetail` is theirs -- so a page that simply rendered would show a supervisor
 * four forms that all 403. A user carries no `permissionHints` (DEC-110), so this is the role
 * check that decision has to be, and it is `forbidden()` rather than a hidden section: arriving
 * here at all means somebody typed the address.
 *
 * **What is missing is missing because core-api does not disclose it.** Notification settings and
 * the interface preferences are attached to `privateData` only for the account's owner (verified
 * live: `settings` and `uiData` are absent when anybody else reads the same user), so this screen
 * cannot show them, and the legacy one does not either. The same is true of the iCal tokens.
 */
export default async function EditUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId }, locale, viewer] = await Promise.all([params, getLocale(), getCurrentUser()]);

  if (userId === viewer.id) redirect({ href: "/profile/edit", locale });
  if (viewer.role !== "superadmin") forbidden();

  const [t, account, breadcrumbs] = await Promise.all([
    getTranslations("UserEdit"),
    getAccountSettings(userId),
    resolveBreadcrumbs(`/users/${userId}/edit`, locale),
  ]);

  const name = [account.firstName, account.lastName].filter(Boolean).join(" ");

  return (
    <PageShell
      title={name || t("unnamed")}
      subtitle={t("subtitle")}
      breadcrumbs={breadcrumbs}
      actions={
        <Link href={`/users/${account.id}`} className={buttonClasses("outline", "sm")}>
          <BackIcon />
          {t("backToProfile")}
        </Link>
      }
    >
      <div className="flex flex-col gap-10">
        <section aria-labelledby="user-profile">
          <h2 id="user-profile" className="mb-3 text-base font-semibold tracking-tight">
            {t("profile.title")}
          </h2>
          <ProfileForm account={account} />
        </section>

        <section aria-labelledby="user-role">
          <h2 id="user-role" className="mb-3 text-base font-semibold tracking-tight">
            {t("role.title")}
          </h2>
          <RoleForm account={account} />
        </section>

        {account.isLocal && (
          <section aria-labelledby="user-password">
            <h2 id="user-password" className="mb-3 text-base font-semibold tracking-tight">
              {t("password.title")}
            </h2>
            <AdminPasswordForm account={account} />
          </section>
        )}

        <section aria-labelledby="user-external-ids">
          <h2 id="user-external-ids" className="mb-3 text-base font-semibold tracking-tight">
            {t("externalIds.title")}
          </h2>
          <ExternalIds account={account} />
        </section>

        <section aria-labelledby="user-access">
          <h2 id="user-access" className="mb-3 text-base font-semibold tracking-tight">
            {t("access.title")}
          </h2>
          <AccountAccess account={account} />
        </section>
      </div>
    </PageShell>
  );
}
