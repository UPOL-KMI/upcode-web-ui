import "server-only";

import { cache } from "react";

import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";
import { deadlineSources } from "@/lib/groups/deadline-sources";
import { isDataOnly } from "@/lib/status/exercise-validation";

import { requireSession } from "@/lib/auth/require-session";

import { ApiError, apiGet, apiPost } from "./client";
import { apiRead } from "./read";
import { getMyGroups, getMyGroupStats, type GroupAssignmentStats } from "./groups";
import { getGroupShadowAssignments } from "./shadow-assignment";

/**
 * The student half of the dashboard (S-001), assembled server-side so the browser makes no
 * follow-up request and sees no waterfall (`docs/IA.md` §3.2).
 *
 * Two sources, and only one of them costs anything here: the per-group student stats arrive with
 * the group list the app shell already fetches (see `fetchUserGroups`), so the only additional
 * calls are one `/v1/groups/{id}/assignments` per group the user studies in. There is no
 * collection endpoint for assignments to replace those with -- checked against core-api's own
 * router, the same gap Q-011 records for search -- so a per-group fan-out is the shape available,
 * not a first draft to optimise later.
 */
export interface UpcomingAssignment {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  firstDeadline: number;
  secondDeadline: number | null;
  allowSecondDeadline: boolean;
  /** The deadline this row is sorted and filtered by: the second one where it still applies. */
  effectiveDeadline: number;
  isBonus: boolean;
  /** The viewer's own standing on this assignment. Absent when they are not a student in the
   *  group -- a teacher planning around the same deadline has no solution of their own. */
  stats?: Pick<GroupAssignmentStats, "status" | "accepted"> & {
    /** The assignment collects files rather than running code (DEC-141). */
    dataOnly?: boolean;
    /** Somebody awarded points -- approximated, see `AssignmentProgressInput`. */
    graded?: boolean;
    gained: number | null;
    bonus: number | null;
    total: number;
  };
}

export interface GroupProgress {
  id: string;
  name: string;
  gained: number;
  total: number;
  limit: number | null;
  hasLimit: boolean;
  passesLimit: boolean;
  assignmentCount: number;
  solvedCount: number;
}

/**
 * A shadow assignment the reader is a student of (S-025).
 *
 * Their **points** were already on this page before this existed -- `points.total`/`gained` in the
 * group progress cards include shadow assignments, because core-api folds them in
 * (`GroupViewFactory::getStudentStatsInternal`). What was missing is which ones they are, and the
 * only place to learn that is `/v1/groups/{id}/shadow-assignments`, one call per group.
 */
export interface MyShadowAssignment {
  id: string;
  name: string;
  groupId: string;
  groupName: string;
  maxPoints: number;
  isBonus: boolean;
  /** null when nothing has been awarded to this reader yet. */
  myPoints: number | null;
  myNote: string;
  /** Informative only -- nothing is submitted, so nothing is enforced against it (S-020). */
  deadline: number | null;
}

export interface StudentDashboard {
  /** Still open for submission, nearest deadline first. */
  upcoming: UpcomingAssignment[];
  /** One entry per group the user studies in, in the order the sidebar lists them. */
  progress: GroupProgress[];
  /**
   * Work with nothing to submit, across every group the reader studies in (S-025).
   *
   * A list of its own, never rows in `upcoming` -- every column of that table is about a
   * submission, and none of them can be filled in for a shadow assignment (DEC-079, which decided
   * the same question for the group screen). Deliberately **not** in the calendar either: a shadow
   * deadline is the teacher's note to themselves, and putting it beside enforced ones would state
   * something about it that is not true.
   */
  shadow: MyShadowAssignment[];
}

interface AssignmentPayload {
  id: string;
  groupId: string;
  runtimeEnvironmentIds?: string[];
  localizedTexts?: LocalizedText[];
  firstDeadline: number;
  secondDeadline: number;
  allowSecondDeadline: boolean;
  maxPointsBeforeFirstDeadline: number;
  isBonus: boolean;
}

/**
 * `secondDeadline` is `0`, not `null`, when an assignment has none -- confirmed on a live
 * response. Reading it without this guard produces a 1970 date, and worse, a comparison that
 * silently reports every such assignment as long closed.
 */
function effectiveDeadlineOf(assignment: AssignmentPayload): number {
  return assignment.allowSecondDeadline && assignment.secondDeadline > 0
    ? assignment.secondDeadline
    : assignment.firstDeadline;
}

/**
 * One group's assignments -- every dashboard section needs them, and by S-003 there are three:
 * the student half fans out over the groups the viewer studies in, the teacher half over the ones
 * they teach, and the calendar over both. Memoized per request (React's `cache()`, the same
 * per-render-only memoization `getCurrentUser()` explains at length) so a group that appears in
 * two of those is fetched once, not twice. Not a cross-request cache: this is per-user, per-ACL
 * data, and DEC-021's rule against caching it still stands.
 */
const fetchGroupAssignments = cache(async function fetchGroupAssignments(
  groupId: string,
): Promise<AssignmentPayload[]> {
  return apiRead<AssignmentPayload[]>("/v1/groups/{id}/assignments", {
    pathParams: { id: groupId },
  });
});

/**
 * Filtering by "now" on the server is safe where rendering it would not be (AGENTS.md §6.6): this
 * decides which rows exist, once, and the client renders exactly that list -- nothing is
 * recomputed during hydration, and nothing here is cached to go stale.
 */
function openAssignmentsOf(
  assignments: AssignmentPayload[],
  group: { id: string; name: string },
  locale: string,
  now: number,
): UpcomingAssignment[] {
  const open: UpcomingAssignment[] = [];
  for (const assignment of assignments) {
    const effectiveDeadline = effectiveDeadlineOf(assignment);
    if (effectiveDeadline <= now) continue;

    open.push({
      id: assignment.id,
      name: localizedName(assignment.localizedTexts, locale),
      groupId: group.id,
      groupName: group.name,
      firstDeadline: assignment.firstDeadline,
      secondDeadline: assignment.secondDeadline > 0 ? assignment.secondDeadline : null,
      allowSecondDeadline: assignment.allowSecondDeadline,
      effectiveDeadline,
      isBonus: assignment.isBonus,
    });
  }
  return open;
}

const byUrgency =
  (locale: string) =>
  (a: UpcomingAssignment, b: UpcomingAssignment): number =>
    a.effectiveDeadline - b.effectiveDeadline || a.name.localeCompare(b.name, locale);

export async function getStudentDashboard(locale: string): Promise<StudentDashboard> {
  const { member } = await getMyGroups(locale);
  if (member.length === 0) return { upcoming: [], progress: [], shadow: [] };

  const [statsByGroup, assignmentsPerGroup, shadowPerGroup] = await Promise.all([
    getMyGroupStats(),
    Promise.all(member.map((group) => fetchGroupAssignments(group.id))),
    Promise.all(member.map((group) => getGroupShadowAssignments(group.id, locale))),
  ]);

  const now = Date.now() / 1000;
  const upcoming: UpcomingAssignment[] = [];
  const progress: GroupProgress[] = [];
  const shadow: MyShadowAssignment[] = [];

  member.forEach((group, index) => {
    const assignments = assignmentsPerGroup[index]!;
    const groupStats = statsByGroup.get(group.id);
    const statsByAssignment = new Map(
      (groupStats?.assignments ?? []).map((stats) => [stats.id, stats]),
    );
    const maxPointsById = new Map(
      assignments.map((assignment) => [assignment.id, assignment.maxPointsBeforeFirstDeadline]),
    );
    const dataOnlyById = new Map(
      assignments.map((assignment) => [
        assignment.id,
        isDataOnly(assignment.runtimeEnvironmentIds ?? []),
      ]),
    );

    for (const open of openAssignmentsOf(assignments, group, locale, now)) {
      const stats = statsByAssignment.get(open.id);
      upcoming.push({
        ...open,
        stats: {
          status: stats?.status ?? null,
          accepted: stats?.accepted ?? null,
          gained: stats?.points.gained ?? null,
          bonus: stats?.points.bonus ?? null,
          // The stats row is the authority on an assignment's maximum where it exists, but a
          // student can see an assignment that no stats row covers (a group joined moments ago),
          // and a missing maximum would render every such row as "0 points available".
          total: stats?.points.total ?? maxPointsById.get(open.id) ?? 0,
          dataOnly: dataOnlyById.get(open.id) ?? false,
          graded: (stats?.points.gained ?? 0) > 0 || (stats?.points.bonus ?? 0) !== 0,
        },
      });
    }

    for (const entry of shadowPerGroup[index]!) {
      shadow.push({
        id: entry.id,
        name: entry.name,
        groupId: group.id,
        groupName: group.name,
        maxPoints: entry.maxPoints,
        isBonus: entry.isBonus,
        myPoints: entry.myPoints,
        myNote: entry.myNote,
        deadline: entry.deadline,
      });
    }

    if (groupStats) {
      progress.push({
        id: group.id,
        name: group.name,
        gained: groupStats.points.gained,
        total: groupStats.points.total,
        limit: groupStats.points.limit,
        hasLimit: groupStats.hasLimit,
        passesLimit: groupStats.passesLimit,
        assignmentCount: groupStats.assignments.length,
        solvedCount: groupStats.assignments.filter((stats) => stats.status === "done").length,
      });
    }
  });

  upcoming.sort(
    (a, b) => a.effectiveDeadline - b.effectiveDeadline || a.name.localeCompare(b.name, locale),
  );
  // Awaiting points first: those are the rows the reader can still do something about. Then by
  // group, so several from one course stay together, and by name within it.
  shadow.sort(
    (a, b) =>
      Number(a.myPoints !== null) - Number(b.myPoints !== null) ||
      a.groupName.localeCompare(b.groupName, locale) ||
      a.name.localeCompare(b.name, locale),
  );

  return { upcoming, progress, shadow };
}

/**
 * The teacher half of the dashboard (S-002). Three panels, three questions `docs/IA.md` §4.1
 * asks: what needs my attention (reviews I have opened and not finished), what are students
 * waiting on me for (reviews they have asked for), and what is coming up (deadlines in the groups
 * I teach, for planning).
 *
 * The two review queues are one request each and carry their own assignments with them, so no
 * fan-out: core-api's `pending-reviews`/`review-requests` both answer
 * `{solutions, assignments}`. Only the author names need a second call -- solutions carry an
 * `authorId` and nothing else about the person -- and that is one batched `POST /v1/users/list`
 * for both queues together, the same endpoint the legacy dashboard uses for exactly this.
 */
export interface ReviewQueueItem {
  solutionId: string;
  authorId: string;
  authorName: string;
  assignmentId: string;
  assignmentName: string;
  groupId: string | null;
  groupName: string | null;
  /**
   * What the queue is sorted by, oldest first. For an open review it is when the teacher opened
   * it; for a review request it is when the student submitted the solution -- core-api records no
   * separate "requested at" timestamp, and the submission time is the honest lower bound on how
   * long they have been waiting.
   */
  since: number;
}

export interface TeacherDashboard {
  pendingReviews: ReviewQueueItem[];
  reviewRequests: ReviewQueueItem[];
  upcoming: UpcomingAssignment[];
}

interface SolutionPayload {
  id: string;
  authorId: string;
  assignmentId: string;
  createdAt: number;
  review: { startedAt: number; closedAt: number | null } | null;
}

interface ReviewQueuePayload {
  solutions: SolutionPayload[];
  assignments: AssignmentPayload[];
}

/**
 * Core-api grants `listPendingReviews`/`listReviewRequests` from the `supervisor-student` role
 * upwards, and group membership is a separate axis from the global role -- so a group admin whose
 * global role is `student` reaches this code and is refused. Treating a 403 as an empty queue is
 * the same choice D-015's search route made: attempt it and let core-api decide, rather than
 * reimplementing its rule here and drifting from it.
 */
async function fetchReviewQueue(
  path: "/v1/users/{id}/pending-reviews" | "/v1/users/{id}/review-requests",
  userId: string,
): Promise<ReviewQueuePayload> {
  try {
    return await apiGet<ReviewQueuePayload>(path, { pathParams: { id: userId } });
  } catch (error) {
    if (error instanceof ApiError && error.httpStatus === 403) {
      return { solutions: [], assignments: [] };
    }
    throw error;
  }
}

export async function getTeacherDashboard(locale: string): Promise<TeacherDashboard> {
  const mine = await getMyGroups(locale);
  const { member, teaching: allTeaching } = mine;
  const teaching = allTeaching.filter((group) => !group.organizational);
  // Which courses the deadlines come from, and why they are the narrow set: `deadlineSources`.
  const { teaching: own } = deadlineSources(mine);
  // Whether this reader is a teacher *anywhere* is still the wide question -- somebody who
  // administers a department without teaching in it can still have a review on their plate.
  if (teaching.length === 0) return { pendingReviews: [], reviewRequests: [], upcoming: [] };

  const session = await requireSession();
  const [pending, requested, assignmentsPerGroup] = await Promise.all([
    fetchReviewQueue("/v1/users/{id}/pending-reviews", session.userId),
    fetchReviewQueue("/v1/users/{id}/review-requests", session.userId),
    Promise.all(own.map((group) => fetchGroupAssignments(group.id))),
  ]);

  // A solution's group comes from its assignment, and the name from the lists already fetched --
  // a teacher can hold a pending review in a group they also study in, so both lists count.
  //
  // **Built from the wide set on purpose.** core-api decides what is on this person's plate, and it
  // may put a review there from a group they administer without teaching; looked up in the narrow
  // set, that review would print without a group name.
  const groupNames = new Map([...member, ...teaching].map((group) => [group.id, group.name]));

  const authorIds = [
    ...new Set([...pending.solutions, ...requested.solutions].map((s) => s.authorId)),
  ];
  const authors =
    authorIds.length > 0
      ? await apiPost<{ id: string; fullName: string }[]>("/v1/users/list", { ids: authorIds })
      : [];
  const authorNames = new Map(authors.map((author) => [author.id, author.fullName]));

  const toQueue = (
    payload: ReviewQueuePayload,
    since: (solution: SolutionPayload) => number,
  ): ReviewQueueItem[] => {
    const assignments = new Map(payload.assignments.map((a) => [a.id, a]));
    return payload.solutions
      .map((solution) => {
        const assignment = assignments.get(solution.assignmentId);
        const groupId = assignment?.groupId ?? null;
        return {
          solutionId: solution.id,
          authorId: solution.authorId,
          // A name core-api would not disclose is not a reason to drop the row: the review is
          // still waiting, and the assignment still identifies it.
          authorName: authorNames.get(solution.authorId) ?? "",
          assignmentId: solution.assignmentId,
          assignmentName: localizedName(assignment?.localizedTexts, locale),
          groupId,
          groupName: groupId ? (groupNames.get(groupId) ?? null) : null,
          since: since(solution),
        };
      })
      .sort((a, b) => a.since - b.since);
  };

  const now = Date.now() / 1000;
  const upcoming = own
    .flatMap((group, index) => openAssignmentsOf(assignmentsPerGroup[index]!, group, locale, now))
    .sort(byUrgency(locale));

  return {
    pendingReviews: toQueue(
      pending,
      (solution) => solution.review?.startedAt ?? solution.createdAt,
    ),
    reviewRequests: toQueue(requested, (solution) => solution.createdAt),
    upcoming,
  };
}

/**
 * Every deadline in one month, for the dashboard's calendar (S-003).
 *
 * Covers both halves of the reader's life at once -- the groups they study in and the ones they
 * teach -- because a calendar that showed only one of them would be lying about their month.
 *
 * **The teaching half is the courses they are named on, not the ones they inherited** (X-017).
 * core-api's own iCal export is wider than this ("deadline events for all assignments in all groups
 * related to you", the legacy calendar-token screen's own words), so a subscribed calendar and this
 * one no longer agree for an administrator of a department -- which is the point: what they inherit
 * can be several hundred deadlines belonging to colleagues, and a month drawn out of that is not a
 * calendar.
 *
 * Costs nothing on a page that already rendered the other two sections: `fetchGroupAssignments`
 * is memoized per request, so the groups they were built from are not fetched a second time here.
 *
 * Unlike the two "upcoming" panels this deliberately does **not** filter by now -- a calendar
 * showing only the future would blank out the first three weeks of the month you are looking at.
 */
export interface CalendarDeadline {
  assignmentId: string;
  assignmentName: string;
  groupId: string;
  groupName: string;
  at: number;
  /** Which of the assignment's two deadlines this entry is -- both are real dates to plan around. */
  kind: "first" | "second";
}

/** Constructing the formatter is the expensive half of ICU formatting and `dayOf` runs twice per
 *  assignment below; keyed by zone rather than collapsed to one instance so a per-user zone still
 *  works. */
const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** Buckets an instant into a calendar day **in the app's time zone**, never the server's. */
function dayOf(unixSeconds: number, timeZone: string): string {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter.format(new Date(unixSeconds * 1000));
}

export async function getDeadlineCalendar(
  locale: string,
  timeZone: string,
  range: { first: string; last: string },
): Promise<Map<string, CalendarDeadline[]>> {
  const { calendar: groups } = deadlineSources(await getMyGroups(locale));
  if (groups.length === 0) return new Map();

  const assignmentsPerGroup = await Promise.all(
    groups.map((group) => fetchGroupAssignments(group.id)),
  );

  const byDay = new Map<string, CalendarDeadline[]>();
  const add = (day: string, deadline: CalendarDeadline) => {
    if (day < range.first || day > range.last) return;
    const existing = byDay.get(day);
    if (existing) {
      existing.push(deadline);
    } else {
      byDay.set(day, [deadline]);
    }
  };

  groups.forEach((group, index) => {
    for (const assignment of assignmentsPerGroup[index]!) {
      const base = {
        assignmentId: assignment.id,
        assignmentName: localizedName(assignment.localizedTexts, locale),
        groupId: group.id,
        groupName: group.name,
      };
      add(dayOf(assignment.firstDeadline, timeZone), {
        ...base,
        at: assignment.firstDeadline,
        kind: "first",
      });
      if (assignment.allowSecondDeadline && assignment.secondDeadline > 0) {
        add(dayOf(assignment.secondDeadline, timeZone), {
          ...base,
          at: assignment.secondDeadline,
          kind: "second",
        });
      }
    }
  });

  for (const deadlines of byDay.values()) {
    deadlines.sort(
      (a, b) => a.at - b.at || a.assignmentName.localeCompare(b.assignmentName, locale),
    );
  }

  return byDay;
}

/** Today, as a `YYYY-MM-DD` day in the app's time zone -- the calendar's idea of "now". */
export function todayIn(timeZone: string): string {
  return dayOf(Date.now() / 1000, timeZone);
}
