import { Suspense } from "react";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

import {
  canSeeAdminSection,
  canSeeExerciseSection,
  canSeeUserDirectory,
  getCurrentUser,
} from "@/lib/api/current-user";
import { ORIGIN_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { getMyGroups } from "@/lib/api/groups";
import { getActiveSystemMessages } from "@/lib/api/system-messages";

import { ActiveMessages } from "@/components/messages/active-messages";

import { ViewAsBanner } from "./view-as-banner";

import { SessionBar } from "./session-bar";
import { SidebarNav, SkipToContent, type NavSection } from "./sidebar-nav";

/**
 * The application shell (D-014) -- the gap found during D-001, when `PageShell` was built and it
 * became clear nothing owned the frame it sits inside. `docs/IA.md` §3.1 specifies the sections
 * and, importantly, their *visibility rules*: "My Groups" and "My Teaching" come from per-group
 * membership rather than the global role, and are not mutually exclusive -- someone supervising
 * one course while taking another sees both.
 *
 * **This component is deliberately synchronous, and that is PF-002.** It used to `await` its three
 * core-api reads before returning the tree that holds `{children}`, and a page is only rendered
 * once its layout has returned -- so no page under `(app)` began fetching until the shell had
 * finished, and every authenticated screen cost shell + page rather than `max(shell, page)`. On
 * `/solutions/[id]/sources` that was two shell round trips in front of six of the page's own. The
 * fix is the one Next's own bundled `loading.md` names: nothing is awaited here, and the two parts
 * that need data are siblings of `{children}` inside their own `<Suspense>` boundaries, so all
 * three start at once.
 *
 * It has a second effect worth naming: **`(app)/loading.tsx` is reachable now**, and was not
 * before. Next wraps the page in a boundary whose fallback is that file, but a suspended *layout*
 * is above that boundary, so the fallback never got the chance to render.
 *
 * **The trade is that the sidebar streams in rather than being in the first byte** -- the opposite
 * of what this docblock promised until PF-002. The frame's width is reserved so the page does not
 * jump sideways when it arrives, and the shell's reads are unchanged in number: `getCurrentUser()`
 * is `cache()`-memoized per request (see its own note), so the two boundaries below share the one
 * call they both make.
 *
 * Sections whose destination does not exist yet are simply absent rather than rendered as dead
 * links -- the routes listed here are all real entries in `app/[locale]/(app)/`.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* First in the tab order, before the sidebar's one link per enrolled and taught group --
          and outside both boundaries below, so it is in the first byte even though the sidebar it
          skips past is not. */}
      <SkipToContent />
      <Suspense fallback={<SidebarPlaceholder />}>
        <Sidebar />
      </Suspense>
      {/* The page's landmark, so assistive technology can jump past the sidebar -- and so a
          heading in the page cannot be confused with the identically-named sidebar section.
          `tabIndex={-1}` so the skip link moves focus rather than only the scroll position. */}
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
        {/* Its own boundary: the shell must not wait on a user read to paint the page (PF-002). */}
        <Suspense fallback={null}>
          <CurrentSession />
        </Suspense>
        {/* Above the page rather than behind a bell in a header: a broadcast worth writing is
            worth reading without opening a dropdown, and this shell has no header to hang one on
            (DEC-115). Its fallback is nothing at all, which is also what it renders on the far
            more common request with no unread broadcast and no narrowed role -- so this boundary
            resolving moves the page down only when there is something to say. */}
        <Suspense fallback={null}>
          <SessionNotices />
        </Suspense>
        {children}
      </main>
    </div>
  );
}

/**
 * Holds the sidebar's width while it loads, and nothing else.
 *
 * Only from `md` up, where the real sidebar is a 16rem column and an unreserved one would shift
 * the whole page sideways on arrival. Below `md` the sidebar is a toggle bar and a closed drawer,
 * so there is no width to reserve and a full-width placeholder would reserve the wrong thing.
 * Decorative, so it is hidden from assistive technology: the region it stands in for announces
 * itself when it arrives, as its own `<nav aria-label>`.
 */
function SidebarPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="hidden shrink-0 border-border bg-card md:block md:w-64 md:border-r"
    />
  );
}

/** The sidebar's own two reads, behind their own boundary so `{children}` does not wait for them. */
async function Sidebar() {
  // `getLocale()` reads next-intl's request config rather than core-api, so awaiting it first costs
  // nothing and keeps the reads below in one wave -- neither derives from the other, and each calls
  // `requireSession()` itself, so ordering them would authorise nothing.
  const locale = await getLocale();
  const [t, user, groups] = await Promise.all([
    getTranslations("Nav"),
    getCurrentUser(),
    getMyGroups(locale),
  ]);

  // **The groups this person is named on, not every group they may act in** (DEC-150). core-api
  // inherits group-admin membership down the whole subtree, so an administrator of a department
  // container administers every course beneath it -- and the operator's own menu listed his whole
  // department under "My teaching", none of which he teaches. `teachingDirect` is a direct
  // supervisor membership or an administrator named on the group itself. The wider `teaching` is
  // still the right answer elsewhere, which is why both exist and only this one reads this.
  //
  // **An organizational group is not something anybody teaches** (DEC-140) either: it has no
  // students and no assignments, so a container has no business under this heading. Containers stay
  // reachable through the group list, the parent link and the breadcrumbs, which is how one is
  // reached anyway.
  const teaching = groups.teachingDirect.filter((group) => !group.organizational);

  const sections: NavSection[] = [
    // No heading: `IA.md` §3.1 gives this section a Calendar as well, and until it exists the
    // heading sat over one link to a page of the same name.
    {
      id: "dashboard",
      items: [{ href: "/dashboard", label: t("home") }],
    },
    {
      id: "groups",
      title: t("myGroups"),
      // **The list itself comes first, and it was missing.** `IA.md` §3.1 specified this section
      // as the groups you belong to, and nothing anywhere linked to `/groups` -- so a reader in no
      // groups saw an empty section, and the screen that creates one was reachable only by typing
      // its address. Found by the operator on a fresh instance, where an administrator belongs to
      // nothing by definition.
      items: [
        { href: "/groups", label: t("allGroups") },
        ...groups.member.map((group) => ({ href: `/groups/${group.id}`, label: group.name })),
      ],
    },
    // IA §3.1: shown "only if any exist" -- an empty teaching section on a student's sidebar is
    // noise, whereas an empty "My Groups" still tells a new student where their courses will
    // appear once they enrol.
    ...(teaching.length > 0
      ? [
          {
            id: "teaching",
            title: t("myTeaching"),
            items: teaching.map((group) => ({
              href: `/groups/${group.id}`,
              label: group.name,
            })),
          },
        ]
      : []),
    // **Both of these are refused to a plain student**, so the section is not offered to one at
    // all: core-api grants `exercise.viewAll` and `pipeline.viewAll` from `supervisor-student` up,
    // and a student who followed either link landed on the refusal page. Reported by the operator,
    // reading his own students' sidebar.
    ...(canSeeExerciseSection(user.role)
      ? [
          {
            id: "exercises",
            title: t("exercises"),
            items: [
              { href: "/exercises", label: t("exerciseCatalog") },
              { href: "/pipelines", label: t("pipelines") },
            ],
          },
        ]
      : []),
    {
      id: "people",
      title: t("people"),
      // One's own profile is everybody's; the directory needs `user.viewAll`, which a student does
      // not have. (They do have `user.viewList` -- a different action, and not the one this page
      // asks for, which is why the link looked plausible.)
      items: [
        { href: "/profile", label: t("profile") },
        ...(canSeeUserDirectory(user.role) ? [{ href: "/users", label: t("users") }] : []),
      ],
    },
    ...(canSeeAdminSection(user.role)
      ? [
          {
            id: "admin",
            title: t("admin"),
            items: [
              { href: "/admin", label: t("server") },
              { href: "/admin/instances", label: t("instances") },
              { href: "/system-messages", label: t("systemMessages") },
              { href: "/archive", label: t("archive") },
              { href: "/submission-failures", label: t("submissionFailures") },
            ],
          },
        ]
      : []),
  ];

  return <SidebarNav sections={sections} />;
}

/**
 * What the shell has to say about the session before the page says anything (G-023, AD-007),
 * behind its own boundary for PF-002's reason: it reads core-api, and the page must not wait for
 * it.
 *
 * The two live together because they need the same `getCurrentUser()` -- memoized per request, so
 * one call serves both -- and because they are one thing from the reader's side: a strip above
 * the page telling them something about *their* situation rather than about what they asked for.
 * The view-as banner comes first, since what this session can currently do frames everything
 * under it.
 */
async function SessionNotices() {
  const [locale, user, broadcasts] = await Promise.all([
    getLocale(),
    getCurrentUser(),
    getActiveSystemMessages(),
  ]);

  // core-api keeps one "seen up to" timestamp rather than a flag per message (AD-007), so unread
  // is everything published since. A message written in neither of this app's languages is
  // dropped rather than rendered blank -- `localizedTexts` may hold any subset.
  const unread = broadcasts
    .filter((message) => message.visibleFrom > (user.messagesReadUpTo ?? 0))
    .map((message) => ({
      id: message.id,
      type: message.type,
      visibleFrom: message.visibleFrom,
      text: (message.texts.find((text) => text.locale === locale) ?? message.texts[0])?.text ?? "",
    }))
    .filter((message) => message.text !== "");

  return (
    <>
      {user.role !== user.accountRole && <ViewAsBanner role={user.role} />}
      <ActiveMessages messages={unread} userId={user.id} />
    </>
  );
}

/** The signed-in reader's name and the sign-out control. Renders nothing if the read fails --
 *  chrome that cannot load is not worth an error page over the content it decorates. */
async function CurrentSession() {
  const [name, cookieStore] = await Promise.all([currentReaderName(), cookies()]);
  if (name === null) return null;
  return <SessionBar fullName={name} takenOver={cookieStore.has(ORIGIN_COOKIE_NAME)} />;
}

/** The read is kept out of the JSX: a failure here must not take down the page this decorates,
 *  and constructing JSX inside a `try` catches nothing, since rendering happens after it. */
async function currentReaderName(): Promise<string | null> {
  try {
    return (await getCurrentUser()).fullName;
  } catch {
    return null;
  }
}
