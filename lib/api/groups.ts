import "server-only";

import { cache } from "react";

import { requireSession } from "@/lib/auth/require-session";
import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import { apiRead } from "./read";

/**
 * The two group lists the sidebar shows (`docs/IA.md` §3.1: "My Groups" and "My Teaching").
 *
 * `GET /v1/users/{id}/groups` returns them already split into `student` and `supervisor` -- which
 * matters, because the IA is explicit that these sections derive from **per-group membership**,
 * not from the global role, and that they are not mutually exclusive: someone who supervises one
 * course while taking another sees both. Core-api filters archived groups out of both lists
 * itself (confirmed in `UsersPresenter::actionGroups`), so the sidebar does not need to.
 */
export interface SidebarGroup {
  id: string;
  name: string;
  /** A container in the tree rather than a course: no students, no assignments (DEC-140). */
  organizational: boolean;
}

/**
 * The caller's own standing in one group, as core-api computes it
 * (`GroupViewFactory::getStudentStatsInternal`). Verified against a live response, not the spec
 * file, which carries no response schemas at all (see `lib/api/client.ts`).
 *
 * `points.total` and `points.gained` already **include shadow assignments**, so a progress figure
 * built from them needs no second source. `points.limit` is the absolute points threshold the
 * group passes at -- core-api resolves the group's percentage `threshold` into points here, so
 * this is the only field a UI needs; `hasLimit` distinguishes "no threshold configured" (where
 * `passesLimit` is a meaningless `true`) from a real one.
 */
export interface GroupAssignmentStats {
  id: string;
  /**
   * core-api's four-value job state (`work-in-progress`, `evaluation-failed`, `failed`, `done`),
   * or `null` when the student has no *valid* best solution -- which includes both "never
   * submitted" and "every submission failed infrastructurally". See
   * `lib/status/assignment-progress.ts`, which is where that string is turned into a display state.
   */
  status: string | null;
  points: { total: number; gained: number | null; bonus: number | null };
  bestSolutionId: string | null;
  accepted: boolean | null;
  reviewRequest: boolean;
}

export interface GroupStudentStats {
  userId: string;
  groupId: string;
  points: { total: number; limit: number | null; gained: number };
  hasLimit: boolean;
  passesLimit: boolean;
  assignments: GroupAssignmentStats[];
  shadowAssignments: { id: string; points: { total: number; gained: number | null } }[];
}

interface GroupPayload {
  id: string;
  localizedTexts?: LocalizedText[];
  organizational?: boolean;
  public?: boolean;
  archived?: boolean;
  directlyArchived?: boolean;
  exam?: boolean;
  parentGroupId?: string | null;
  parentGroupsIds?: string[];
  childGroups?: string[];
  /**
   * Administrators named **on this group itself**, as opposed to `privateData.admins`, which is
   * every administrator including the ones inherited from ancestors (`Group::getAdminIdsInternal`
   * walks up the parent chain; `getPrimaryAdminsIds` does not). Top-level and public, so unlike
   * `privateData` it survives a reader who may not see the group's detail.
   */
  primaryAdminsIds?: string[];
  privateData?: {
    admins?: string[];
    supervisors?: string[];
    students?: string[];
    assignments?: string[];
  } | null;
  permissionHints?: Record<string, boolean>;
}

interface UserGroupsPayload {
  student?: GroupPayload[];
  supervisor?: GroupPayload[];
  stats?: GroupStudentStats[];
}

/**
 * Memoized per request, for the same reason as `getCurrentUser()` -- see its note. The memoized
 * unit is deliberately this raw fetch rather than the locale-dependent projections below: the app
 * shell wants group names and the dashboard (S-001) wants the `stats` array, and both arrive in
 * the *same* response, so keying the cache on the request rather than on a locale argument is
 * what makes the dashboard's group data cost zero extra round trips.
 *
 * `stats` is not a separate endpoint: `UsersPresenter::actionGroups` computes
 * `GroupViewFactory::getStudentsStats()` for every group the user studies in and returns it
 * alongside. Note that it does so **without the archived filter** applied to `student`/
 * `supervisor`, so `stats` can describe groups absent from both lists -- consumers must match by
 * `groupId` rather than assume the arrays line up.
 */
const fetchUserGroups = cache(async function fetchUserGroups(): Promise<UserGroupsPayload> {
  const session = await requireSession();
  return apiRead<UserGroupsPayload>("/v1/users/{id}/groups", {
    pathParams: { id: session.userId },
  });
});

/**
 * Every non-archived group the caller can see at all -- for a normal user that is exactly the
 * groups they belong to plus their ancestors, because core-api restricts the result set by
 * membership for anyone without the global `viewAll` permission (`GroupsPresenter::actionDefault`).
 * Privileged users get the whole instance, which is what the legacy app fetches on every page too.
 *
 * Needed because **`/v1/users/{id}/groups` does not report group administrators** (S-001, DEC-058):
 * its `supervisor` key is `User::getGroupsAsSupervisor()`, one specific membership type, so a user
 * who *administers* a group appears in neither list. Group admins are discoverable only from the
 * group's own payload, which is how the legacy app derives the same thing.
 *
 * **Two fields there, not one**, and `getMyGroups` reads both: `privateData.admins` is every
 * administrator *including the inherited ones*, `primaryAdminsIds` only those named on the group
 * itself. DEC-058 rejected `primaryAdminsIds` and that rejection still stands where it was made --
 * on the `/v1/users/{id}/groups` payload, which carries it only for groups already in one of the
 * two lists, i.e. never for the case that needs it. Here, on the group's own payload, it is
 * present for everything in scope.
 */
const fetchGroupsInScope = cache(async function fetchGroupsInScope(
  scope: "active" | "archived",
): Promise<GroupPayload[]> {
  return apiRead<GroupPayload[]>("/v1/groups", {
    query: scope === "archived" ? { onlyArchived: true } : undefined,
  });
});

// The default lives out here rather than on the memoized function: `cache()` keys on the argument
// list *as passed*, so `f()` and `f("active")` would be two entries and the memo would never hit.
function fetchVisibleGroups(scope: "active" | "archived" = "active"): Promise<GroupPayload[]> {
  return fetchGroupsInScope(scope);
}

/**
 * Whether to offer creating a group that hangs directly under an instance (G-008).
 *
 * core-api resolves a parentless `addGroup` to the instance's root group and then checks
 * `canAddSubgroup` on it, so the question this answers is exactly "is there a root the reader may
 * add to". It is asked of the list this app already holds -- `fetchVisibleGroups` is memoized per
 * request and the group screens have called it by the time this runs -- so it costs no round trip.
 *
 * A parentless group is not necessarily *this* reader's instance root: a group's payload does not
 * publish its instance (Q-024), and Q-023 found that deleting an instance leaves its root behind.
 * That only makes this over-permissive by a hint core-api will re-check anyway.
 */
export async function canCreateRootGroup(): Promise<boolean> {
  const groups = await fetchVisibleGroups();
  return groups.some(
    (group) => !group.parentGroupId && group.permissionHints?.addSubgroup === true,
  );
}

/**
 * The caller's own groups: the ones they study in, the ones they may act in as staff, and the
 * narrower list of the ones they are actually named on.
 *
 * **`teaching` and `teachingDirect` differ by inheritance, and the difference is the point.**
 * core-api inherits group-admin membership down the whole subtree, so an administrator of a
 * department container administers every course beneath it -- genuinely, with every right that
 * implies. `teaching` is that set, and the screens that ask "what may this person act on" want it:
 * the group pickers, the teacher dashboard's fetch, the "teacher" badge on the group list.
 *
 * `teachingDirect` is the set a person is *named on* -- a direct supervisor, or an administrator of
 * this very group rather than of something above it. That is the honest answer to "whose courses
 * are these", and it is what the sidebar's "My teaching" is built from: the operator's own menu
 * listed every course in his department, none of which he teaches. Reported by him, and the reason
 * both lists exist rather than one.
 */
export async function getMyGroups(
  locale: string,
): Promise<{ member: SidebarGroup[]; teaching: SidebarGroup[]; teachingDirect: SidebarGroup[] }> {
  const [session, payload, visible] = await Promise.all([
    requireSession(),
    fetchUserGroups(),
    fetchVisibleGroups(),
  ]);

  const toSidebarGroup = (group: GroupPayload): SidebarGroup => ({
    id: group.id,
    name: localizedName(group.localizedTexts, locale),
    organizational: group.organizational ?? false,
  });

  const teaching = new Map<string, SidebarGroup>();
  const teachingDirect = new Map<string, SidebarGroup>();
  // Supervisor membership is direct-only in core-api (`Group::getMemberships` never walks the
  // parent chain), so this half is the same in both lists.
  for (const group of payload.supervisor ?? []) {
    teaching.set(group.id, toSidebarGroup(group));
    teachingDirect.set(group.id, toSidebarGroup(group));
  }
  for (const group of visible) {
    if (group.privateData?.admins?.includes(session.userId)) {
      teaching.set(group.id, toSidebarGroup(group));
    }
    if (group.primaryAdminsIds?.includes(session.userId)) {
      teachingDirect.set(group.id, toSidebarGroup(group));
    }
  }

  const byName = (a: SidebarGroup, b: SidebarGroup) => a.name.localeCompare(b.name, locale);
  return {
    member: (payload.student ?? []).map(toSidebarGroup),
    teaching: [...teaching.values()].sort(byName),
    teachingDirect: [...teachingDirect.values()].sort(byName),
  };
}

/** The caller's own stats, indexed by group id. See `GroupStudentStats` for what they cover. */
export async function getMyGroupStats(): Promise<Map<string, GroupStudentStats>> {
  const payload = await fetchUserGroups();
  return new Map((payload.stats ?? []).map((stats) => [stats.groupId, stats]));
}

/**
 * One row of the group list (S-004), and of the archive (S-011) -- the same shape, because they
 * are the same entity fetched with one query parameter changed.
 *
 * `path` is the group's ancestry as names, which is what makes a flat list navigable without a
 * tree widget: `docs/IA.md` §2 puts subgroups under their parent, and ReCodEx really does nest
 * (the seeded "Intro to Programming / Lab A" is a child of a child of the instance root). The
 * names are resolved from the same response rather than fetched -- core-api returns the groups a
 * user can see *including* the ancestors it had to walk through, so the map is already complete
 * for every group it lists. An ancestor the reader genuinely cannot see is simply absent from the
 * path rather than shown as an id.
 */
export interface GroupListEntry {
  id: string;
  name: string;
  /** Ancestor names, outermost first. Empty for a top-level group. */
  path: string[];
  organizational: boolean;
  public: boolean;
  archived: boolean;
  exam: boolean;
  /** How the reader relates to this group, from their own membership lists rather than a role. */
  membership: "student" | "teacher" | null;
  /** `null` where core-api did not disclose the underlying array to this reader. */
  studentCount: number | null;
  assignmentCount: number | null;
}

export async function getGroupList(
  locale: string,
  scope: "active" | "archived" = "active",
): Promise<GroupListEntry[]> {
  const [groups, mine] = await Promise.all([fetchVisibleGroups(scope), getMyGroups(locale)]);

  const names = new Map(
    groups.map((group) => [group.id, localizedName(group.localizedTexts, locale)]),
  );
  const memberIds = new Set(mine.member.map((group) => group.id));
  const teachingIds = new Set(mine.teaching.map((group) => group.id));

  return groups
    .map((group) => ({
      id: group.id,
      name: names.get(group.id) ?? "",
      path: (group.parentGroupsIds ?? [])
        .map((ancestorId) => names.get(ancestorId))
        .filter((name): name is string => Boolean(name)),
      organizational: group.organizational ?? false,
      public: group.public ?? false,
      archived: group.archived ?? false,
      exam: group.exam ?? false,
      membership: teachingIds.has(group.id)
        ? ("teacher" as const)
        : memberIds.has(group.id)
          ? ("student" as const)
          : null,
      studentCount: group.privateData?.students?.length ?? null,
      assignmentCount: group.privateData?.assignments?.length ?? null,
    }))
    .sort((a, b) =>
      [...a.path, a.name].join("/").localeCompare([...b.path, b.name].join("/"), locale),
    );
}
