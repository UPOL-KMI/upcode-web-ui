import { getLocale, getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/lib/api/current-user";
import { getMyGroups } from "@/lib/api/groups";
import { getUserGroups, getUserProfile } from "@/lib/api/user-profile";

import { Link } from "@/i18n/navigation";
import { DateTime } from "@/components/format/date-time";
import { RelativeTime } from "@/components/format/relative-time";
import { PageShell, type BreadcrumbItem } from "@/components/page-shell";
import { EmptyState } from "@/components/state/empty-state";
import { Badge } from "@/components/status/badge";

import { TakeoverButton } from "./takeover-button";
import { buttonClasses } from "@/components/button";
import { PencilIcon } from "@/components/icons";

/**
 * One person's profile (S-021): who they are, and where in ReCodEx they belong.
 *
 * A component rather than a page, because two routes render it: `/users/:id` and `/profile`, which
 * is the same screen about oneself. `/profile` was a redirect at first, and that was worse in two
 * ways -- an extra round trip on every visit, and a page that is mid-navigation when a caller
 * looks at it, which the token-leakage test caught immediately.
 *
 * **Every row here is a field core-api chose to send.** The private block -- email, role, when the
 * account was made, when it was last used -- exists in the response only under
 * `canViewPrivateData`, so a reader who may not see it gets a page with those rows absent rather
 * than blank. The groups section is the same idea with a different mechanism: a user object
 * carries no `permissionHints` at all (verified live), so the list is fetched and a 403 read as
 * "not disclosed", which is the section simply not being there.
 *
 * A group the person **studies** in also links to what they have submitted there (T-005), where
 * that is the reader's to read: their own, or a group the reader teaches. `viewStudentStats` is a
 * two-subject rule with no hint of its own (DEC-090), so the offer is decided from the reader's own
 * group lists rather than from something core-api says about this page. Editing one's own account
 * is offered because S-022 built it, editing somebody else's because AD-002 did, and signing in as
 * them because AD-003 did -- the last of those is a login rather than a mode, so it leaves this
 * page and does not come back (DEC-112).
 */
export async function ProfileView({
  userId,
  breadcrumbs,
}: {
  userId: string;
  /**
   * Handed over unawaited (PF-005). On `/users/:userId` the crumb chain includes the person's own
   * name, which is a fetch -- awaiting it in the page put that request **alone** in front of
   * everything below, for no reason: nothing here derives from it. The page starts it, this
   * component waits for it beside its own reads, and the promise is never left floating, which is
   * what would turn a refusal into an unhandled rejection.
   */
  breadcrumbs: Promise<BreadcrumbItem[]>;
}) {
  const locale = await getLocale();
  const [crumbs, t, profile, viewer, groups, mine] = await Promise.all([
    breadcrumbs,
    getTranslations("Profile"),
    getUserProfile(userId),
    getCurrentUser(),
    getUserGroups(userId, locale),
    // Already fetched for the app shell's own sidebar this request, so this costs nothing: what
    // it adds here is which of these groups the *reader* teaches, which is what decides whether
    // T-005's drill-down is theirs to open.
    getMyGroups(locale),
  ]);

  const isMe = viewer.id === profile.id;
  const teaching = new Set(mine.teaching.map((group) => group.id));
  const externalIds = Object.entries(profile.externalIds);

  return (
    <PageShell
      title={profile.fullName || t("unnamed")}
      subtitle={isMe ? t("thisIsYou") : undefined}
      breadcrumbs={crumbs}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {profile.isVerified ? (
            <Badge tone="success">{t("verified")}</Badge>
          ) : (
            <Badge tone="warning">{t("unverified")}</Badge>
          )}
          {profile.isAllowed === false && <Badge tone="warning">{t("disabled")}</Badge>}
          {isMe && (
            <Link href="/profile/edit" className={buttonClasses("warning-outline", "sm")}>
              <PencilIcon />
              {t("editMine")}
            </Link>
          )}
          {/* AD-002's screen and AD-003's takeover, both offered on the reader's role because a
              user carries no permission hints (DEC-110), and neither on one's own profile.
              Taking over an account core-api has disabled would produce a session refused at
              every turn, which is why that one is narrower still. */}
          {!isMe && viewer.role === "superadmin" && (
            <>
              <Link
                href={`/users/${profile.id}/edit`}
                className={buttonClasses("warning-outline", "sm")}
              >
                <PencilIcon />
                {t("editTheirs")}
              </Link>
              {profile.isAllowed !== false && (
                <TakeoverButton userId={profile.id} fullName={profile.fullName || t("unnamed")} />
              )}
            </>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-8">
        <section aria-labelledby="profile-overview">
          <h2 id="profile-overview" className="mb-3 text-base font-semibold tracking-tight">
            {t("overview")}
          </h2>
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <Row label={t("name")}>
              {[
                profile.titlesBeforeName,
                profile.firstName,
                profile.lastName,
                profile.titlesAfterName,
              ]
                .filter(Boolean)
                .join(" ") || profile.fullName}
            </Row>
            {profile.email && (
              <Row label={t("email")}>
                <a
                  href={`mailto:${profile.email}`}
                  className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {profile.email}
                </a>
              </Row>
            )}
            {profile.role && <Row label={t("role")}>{t(`roles.${profile.role}`)}</Row>}
            {profile.createdAt !== null && (
              <Row label={t("createdAt")}>
                <DateTime unixSeconds={profile.createdAt} />
              </Row>
            )}
            {profile.lastAuthenticationAt !== null && (
              <Row label={t("lastAuthenticationAt")}>
                <span className="flex flex-wrap items-center gap-2">
                  <DateTime unixSeconds={profile.lastAuthenticationAt} />
                  <span className="text-muted-foreground">
                    <RelativeTime unixSeconds={profile.lastAuthenticationAt} />
                  </span>
                </span>
              </Row>
            )}
            {externalIds.map(([service, identifier]) => (
              <Row key={service} label={t("externalId", { service })}>
                <code className="text-xs">{identifier}</code>
              </Row>
            ))}
          </dl>
        </section>

        {groups !== null && (
          <section aria-labelledby="profile-groups">
            <h2 id="profile-groups" className="mb-3 text-base font-semibold tracking-tight">
              {t("groups")}
            </h2>
            {groups.length === 0 ? (
              <EmptyState
                title={t("noGroups.title")}
                description={t("noGroups.description")}
                headingLevel={3}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {groups.map((group) => (
                  <li
                    key={group.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                  >
                    <Link
                      href={`/groups/${group.id}`}
                      className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {group.name}
                    </Link>
                    <span className="flex flex-wrap items-center gap-3">
                      {group.role === "student" && (isMe || teaching.has(group.id)) && (
                        <Link
                          href={`/groups/${group.id}/users/${profile.id}`}
                          className="text-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {t("groupSolutions")}
                        </Link>
                      )}
                      <Badge tone={group.role === "supervisor" ? "info" : "neutral"}>
                        {t(`membership.${group.role}`)}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </PageShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm">{children}</dd>
    </div>
  );
}
