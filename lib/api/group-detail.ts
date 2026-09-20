import "server-only";

import { cache } from "react";

import { localizedDescription, localizedName, type LocalizedText } from "@/lib/i18n-text/localized";
import { parseExamLockType, type ExamLockType } from "@/lib/status/exam";
import { isDataOnly } from "@/lib/status/exercise-validation";

import { ApiError, apiGet, apiPost } from "./client";
import { apiRead, pageRead } from "./read";
import { getMyGroupStats, type GroupStudentStats } from "./groups";

/**
 * One group, as its own screen needs it (S-005, S-006, S-007).
 *
 * Member **names** are resolved with one batched `POST /v1/users/list` over the id arrays in
 * `privateData`, rather than with `GET /v1/groups/{id}/members`. That endpoint exists and returns
 * ready-made user objects, but core-api marks it `@deprecated` ("Members are listed in group
 * view") and it omits observers entirely -- so it is both the endpoint being retired and the one
 * that answers less. One batched lookup covers all three roles from data the group view already
 * returned.
 */
export interface GroupMember {
  id: string;
  fullName: string;
  /**
   * What they hold **here**, where they hold anything; otherwise the role they inherit.
   *
   * One row per person, not per role. Somebody can be an administrator by inheritance *and* a
   * supervisor named on this group -- core-api reports them in both sets, and listing them twice
   * said less than saying it once with both facts attached.
   */
  role: "admin" | "supervisor" | "observer";
  /**
   * They also administer this group because they administer something above it.
   *
   * core-api inherits group-admin membership down the whole subtree (`Group::getAdminIdsInternal`
   * walks the parent chain) and reports the two sets separately: `privateData.admins` includes the
   * inherited ones, `primaryAdminsIds` does not. Supervisors and observers never inherit.
   */
  inheritedAdmin: boolean;
  /**
   * They hold a membership on this group itself -- which is what makes it editable here.
   *
   * Removing works only on a direct row: `actionRemoveMember` looks it up with
   * `Group::getMembershipOfUser`, which skips inherited ones, and answers *"The user is not a
   * member of the group"* when there is none. Setting a role, by contrast, **creates** a direct
   * membership beside the inherited one -- which is the whole point, and how a colleague who
   * administers a parent gets this course into their own "My teaching".
   */
  direct: boolean;
}

export interface GroupRef {
  id: string;
  name: string;
}

/**
 * One descendant of the group being shown, with what the page needs to nest it.
 *
 * `GET /v1/groups/{id}/subgroups` returns the **whole subtree**, so the flat list has to be put
 * back into a tree before it is rendered -- see `subgroupTree`.
 */
export interface SubgroupRef extends GroupRef {
  parentGroupId: string | null;
  organizational: boolean;
  archived: boolean;
}

/** One locale's name and description, as core-api stores and expects them back. */
export interface GroupText {
  locale: string;
  name: string;
  description: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  /** Every locale core-api holds for this group -- what the settings form edits (S-009). */
  texts: GroupText[];
  /** The course code or similar the deployment keeps beside the name; free-form, often empty. */
  externalId: string;
  /** Markdown, in the reader's locale where it exists. Empty when the group has no description. */
  description: string;
  /** Ancestors, outermost first. */
  path: GroupRef[];
  /** The group this one hangs under. Null only for an instance's root group, which cannot move. */
  parentGroupId: string | null;
  subgroups: SubgroupRef[];
  organizational: boolean;
  public: boolean;
  archived: boolean;
  /** Archived in its own right, as opposed to inheriting it from an archived ancestor (S-009). */
  directlyArchived: boolean;
  exam: boolean;
  publicStats: boolean;
  detaining: boolean;
  /** Percentage (0-1) or absolute points needed to pass; core-api stores one or the other. */
  threshold: number | null;
  pointsLimit: number | null;
  members: GroupMember[];
  studentCount: number | null;
  assignmentCount: number;
  /** Shadow assignments count toward what a course asks of a student, and are listed separately
   *  because nothing about them is submitted. */
  shadowAssignmentCount: number;
  /** The reader's own standing, when they study here. */
  myStats: GroupStudentStats | null;
  /** Ids of the group's students, when this reader may see them -- the exam roster is built from these. */
  studentIds: string[];
  /** The exam this group is currently running or about to (S-008). Null when none is set. */
  examTerm: ExamTerm | null;
  /** Exams that have been recorded, newest last. core-api only records one once a student locks in. */
  exams: ExamTerm[];
  /** core-api's own answer to what this reader may do (brief §3.4) -- never re-derived from roles. */
  can: Record<string, boolean>;
}

export interface ExamTerm {
  /** Absent on the group's own current period -- core-api records an exam entity only on the first lock. */
  id: number | null;
  begin: number;
  end: number;
  lockType: ExamLockType | null;
}

interface GroupPayload {
  id: string;
  externalId?: string | null;
  localizedTexts?: LocalizedText[];
  organizational?: boolean;
  public?: boolean;
  archived?: boolean;
  directlyArchived?: boolean;
  exam?: boolean;
  parentGroupId?: string | null;
  parentGroupsIds?: string[];
  childGroups?: string[];
  /** Administrators named on this group itself -- see `GroupMember.inherited`. */
  primaryAdminsIds?: string[];
  privateData?: {
    admins?: string[];
    supervisors?: string[];
    observers?: string[];
    students?: string[];
    assignments?: string[];
    publicStats?: boolean;
    detaining?: boolean;
    threshold?: number | null;
    pointsLimit?: number | null;
    examBegin?: number | null;
    examEnd?: number | null;
    examLockType?: string | null;
    exams?: { id: number; begin: number; end: number; type?: string | null }[];
  };
  permissionHints?: Record<string, boolean>;
}

// Raw on purpose: an ancestor is fetched through here too, and that call tolerates its own
// failure -- a `catch` around a refusal interrupt would swallow it (F-030). The group this page
// is about goes through `pageRead` at its own call site instead.
const fetchGroup = cache(async function fetchGroup(groupId: string): Promise<GroupPayload> {
  return apiGet<GroupPayload>("/v1/groups/{id}", { pathParams: { id: groupId } });
});

export const getGroupDetail = cache(async function getGroupDetail(
  groupId: string,
  locale: string,
): Promise<GroupDetail> {
  const group = await pageRead(fetchGroup(groupId));
  // `shadowAssignments` is in the response and missing from the generated types -- read from the
  // spec, which does not describe it, rather than from the payload, which carries it.
  const priv = group.privateData as
    (NonNullable<typeof group.privateData> & { shadowAssignments?: string[] }) | undefined;

  // **One row per person, not per role.** core-api reports somebody who administers a parent *and*
  // supervises this group in both sets, and listing them twice said less than one row carrying both
  // facts. The direct role wins where there is one, because that is the one this screen can edit.
  const directAdmins = new Set(group.primaryAdminsIds ?? []);
  const supervisors = new Set(priv?.supervisors ?? []);
  const observers = new Set(priv?.observers ?? []);
  const inheritedAdmins = new Set((priv?.admins ?? []).filter((id) => !directAdmins.has(id)));

  const memberIds = [
    ...new Set([...directAdmins, ...supervisors, ...observers, ...inheritedAdmins]),
  ];
  const roleOf = (id: string): GroupMember["role"] =>
    directAdmins.has(id)
      ? "admin"
      : supervisors.has(id)
        ? "supervisor"
        : observers.has(id)
          ? "observer"
          : "admin"; // inherited administrator, and nothing held here

  const [ancestors, subgroups, people, statsByGroup] = await Promise.all([
    // Named one by one rather than from the group list: an ancestor can be a group this reader is
    // not a member of, which `/v1/groups` need not have returned. `fetchGroup` is memoized, so an
    // ancestor also shown elsewhere on the page costs nothing extra.
    Promise.all((group.parentGroupsIds ?? []).map((id) => fetchGroup(id).catch(() => null))),
    group.childGroups?.length
      ? apiRead<GroupPayload[]>("/v1/groups/{id}/subgroups", { pathParams: { id: groupId } })
      : Promise.resolve([]),
    memberIds.length > 0
      ? apiPost<{ id: string; fullName: string }[]>("/v1/users/list", { ids: memberIds })
      : Promise.resolve([]),
    getMyGroupStats(),
  ]);

  const names = new Map(people.map((person) => [person.id, person.fullName]));

  return {
    id: group.id,
    name: localizedName(group.localizedTexts, locale),
    texts: (group.localizedTexts ?? []).map((text) => ({
      locale: text.locale,
      name: text.name ?? "",
      description: text.description ?? "",
    })),
    externalId: group.externalId ?? "",
    description: localizedDescription(group.localizedTexts, locale),
    path: ancestors
      .filter((ancestor): ancestor is GroupPayload => ancestor !== null)
      .map((ancestor) => ({
        id: ancestor.id,
        name: localizedName(ancestor.localizedTexts, locale),
      })),
    subgroups: subgroups.map((subgroup) => ({
      id: subgroup.id,
      name: localizedName(subgroup.localizedTexts, locale),
      parentGroupId: subgroup.parentGroupId ?? null,
      organizational: subgroup.organizational ?? false,
      archived: subgroup.archived ?? false,
    })),
    parentGroupId: group.parentGroupId ?? null,
    organizational: group.organizational ?? false,
    public: group.public ?? false,
    archived: group.archived ?? false,
    directlyArchived: group.directlyArchived ?? false,
    exam: group.exam ?? false,
    publicStats: priv?.publicStats ?? false,
    detaining: priv?.detaining ?? false,
    threshold: priv?.threshold ?? null,
    pointsLimit: priv?.pointsLimit ?? null,
    members: memberIds.map((id) => ({
      id,
      // A name core-api declined to disclose is not a reason to drop the person: that they hold
      // the role is the fact this list is about.
      fullName: names.get(id) ?? "",
      role: roleOf(id),
      inheritedAdmin: inheritedAdmins.has(id),
      direct: directAdmins.has(id) || supervisors.has(id) || observers.has(id),
    })),
    studentCount: priv?.students?.length ?? null,
    assignmentCount: priv?.assignments?.length ?? 0,
    shadowAssignmentCount: priv?.shadowAssignments?.length ?? 0,
    myStats: statsByGroup.get(groupId) ?? null,
    studentIds: priv?.students ?? [],
    examTerm:
      priv?.examBegin && priv?.examEnd
        ? {
            id: null,
            begin: priv.examBegin,
            end: priv.examEnd,
            lockType: parseExamLockType(priv.examLockType),
          }
        : null,
    exams: [...(priv?.exams ?? [])]
      .sort((a, b) => a.end - b.end || a.begin - b.begin)
      .map((exam) => ({
        id: exam.id,
        begin: exam.begin,
        end: exam.end,
        lockType: parseExamLockType(exam.type),
      })),
    can: group.permissionHints ?? {},
  };
});

/**
 * The groups this one could be moved under (S-009), the legacy app's own filter
 * (`getPossibleParentsOfGroup`): anything the reader may add a subgroup to, except this group
 * itself and its own descendants -- moving a group under its own child would make the hierarchy a
 * loop, which core-api refuses anyway (`checkRelocate`).
 *
 * Archived groups are absent because `/v1/groups` omits them unless asked, which is the right
 * answer here for a second reason: an archived group is immutable, so it is no place to move
 * anything into.
 */
export async function getRelocationTargets(groupId: string, locale: string): Promise<GroupRef[]> {
  const groups = await apiRead<GroupPayload[]>("/v1/groups");

  return groups
    .filter(
      (candidate) =>
        candidate.id !== groupId &&
        candidate.permissionHints?.addSubgroup === true &&
        !(candidate.parentGroupsIds ?? []).includes(groupId),
    )
    .map((candidate) => ({
      id: candidate.id,
      name: [
        ...(candidate.parentGroupsIds ?? [])
          .map((id) => groups.find((group) => group.id === id))
          .filter((group): group is GroupPayload => group !== undefined)
          .map((group) => localizedName(group.localizedTexts, locale)),
        localizedName(candidate.localizedTexts, locale),
      ].join(" / "),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/**
 * The group's assignments, with the reader's own standing on each where they study here (S-006).
 *
 * The filter is applied server-side and lives in the URL, so "the open ones" is a shareable link
 * and no assignment the reader filtered out is shipped to the browser. `submitted` means "I have
 * an evaluated solution", which is the only sense the stats row can answer -- see Q-012 for the
 * case it cannot distinguish.
 */
export type AssignmentFilter = "all" | "open" | "closed" | "submitted";

export interface GroupAssignment {
  id: string;
  name: string;
  firstDeadline: number;
  secondDeadline: number | null;
  allowSecondDeadline: boolean;
  maxPoints: number;
  maxPointsSecond: number;
  isBonus: boolean;
  isPublic: boolean;
  /** Unix seconds, or null for "as soon as it is published" -- the other half of visibility. */
  visibleFrom: number | null;
  /** The reader's own result, when they study in this group. */
  stats: {
    status: string | null;
    gained: number | null;
    bonus: number | null;
    total: number;
    accepted: boolean | null;
    bestSolutionId: string | null;
    /** The assignment collects files rather than running code (DEC-141). */
    dataOnly: boolean;
    /** Somebody awarded points -- approximated from the row, see `AssignmentProgressInput`. */
    graded: boolean;
  } | null;
}

interface AssignmentPayload {
  id: string;
  runtimeEnvironmentIds?: string[];
  localizedTexts?: LocalizedText[];
  firstDeadline: number;
  secondDeadline: number;
  allowSecondDeadline: boolean;
  maxPointsBeforeFirstDeadline: number;
  maxPointsBeforeSecondDeadline: number;
  isBonus: boolean;
  isPublic: boolean;
  visibleFrom?: number | null;
}

export async function getGroupAssignments(
  groupId: string,
  locale: string,
  filter: AssignmentFilter,
): Promise<GroupAssignment[]> {
  const [assignments, statsByGroup] = await Promise.all([
    apiRead<AssignmentPayload[]>("/v1/groups/{id}/assignments", { pathParams: { id: groupId } }),
    getMyGroupStats(),
  ]);

  const myStats = statsByGroup.get(groupId);
  const statsByAssignment = new Map((myStats?.assignments ?? []).map((row) => [row.id, row]));
  const now = Date.now() / 1000;

  return assignments
    .map((assignment) => {
      const stats = statsByAssignment.get(assignment.id);
      const hasSecond = assignment.allowSecondDeadline && assignment.secondDeadline > 0;
      return {
        id: assignment.id,
        name: localizedName(assignment.localizedTexts, locale),
        firstDeadline: assignment.firstDeadline,
        secondDeadline: hasSecond ? assignment.secondDeadline : null,
        allowSecondDeadline: assignment.allowSecondDeadline,
        maxPoints: assignment.maxPointsBeforeFirstDeadline,
        maxPointsSecond: assignment.maxPointsBeforeSecondDeadline,
        isBonus: assignment.isBonus,
        isPublic: assignment.isPublic,
        visibleFrom: assignment.visibleFrom ?? null,
        stats: myStats
          ? {
              status: stats?.status ?? null,
              gained: stats?.points.gained ?? null,
              bonus: stats?.points.bonus ?? null,
              total: stats?.points.total ?? assignment.maxPointsBeforeFirstDeadline,
              accepted: stats?.accepted ?? null,
              bestSolutionId: stats?.bestSolutionId ?? null,
              dataOnly: isDataOnly(assignment.runtimeEnvironmentIds ?? []),
              graded: (stats?.points.gained ?? 0) > 0 || (stats?.points.bonus ?? 0) !== 0,
            }
          : null,
      };
    })
    .filter((assignment) => {
      const effective = assignment.secondDeadline ?? assignment.firstDeadline;
      switch (filter) {
        case "open":
          return effective > now;
        case "closed":
          return effective <= now;
        case "submitted":
          return assignment.stats?.status != null;
        default:
          return true;
      }
    })
    .sort((a, b) => a.firstDeadline - b.firstDeadline || a.name.localeCompare(b.name, locale));
}

/**
 * The group's roster with each student's points (S-007).
 *
 * `GET /v1/groups/{id}/students/stats` answers with every student's row for a reader who may see
 * group stats, and with only their own row for one who may not -- core-api decides that itself
 * (`GroupsPresenter::actionStats`), so this does not gate on a role. Names come from the same
 * batched `/v1/users/list` the member list uses.
 *
 * Per-assignment points are deliberately **not** a column each: that matrix is T-006's screen,
 * where it can be sorted, exported and read at full width. Here each student is one row -- points,
 * whether they pass, how many assignments they have solved.
 */
export interface GroupStudent {
  id: string;
  fullName: string;
  /** Present only where core-api disclosed the person's private data to this reader (G-011). */
  email: string | null;
  gained: number;
  total: number;
  hasLimit: boolean;
  passesLimit: boolean;
  solvedCount: number;
  assignmentCount: number;
}

/**
 * The two reads the roster and the matrix below share, because a Students tab renders both and
 * core-api would otherwise answer the same requests twice.
 *
 * The name lookup is keyed on a **joined id string**, not on the id array: `cache()` compares its
 * arguments by identity, so a freshly built array per caller memoizes nothing.
 */
const fetchStudentStats = cache(async function fetchStudentStats(
  groupId: string,
): Promise<GroupStudentStats[]> {
  return apiRead<GroupStudentStats[]>("/v1/groups/{id}/students/stats", {
    pathParams: { id: groupId },
  });
});

interface StudentPerson {
  fullName: string;
  email: string | null;
}

/**
 * `privateData.email` rides along because it costs nothing: this response already carries it
 * wherever the reader may read it, and the address list G-011's mail control needs was being
 * discarded here. core-api decides the disclosure per person, so a null address is an answer --
 * "not disclosed to you" -- rather than a person without an address.
 */
const fetchStudentPeople = cache(async function fetchStudentPeople(
  idKey: string,
): Promise<Map<string, StudentPerson>> {
  const people = await apiPost<
    { id: string; fullName: string; privateData?: { email?: string } }[]
  >("/v1/users/list", { ids: idKey.split(",") });
  return new Map(
    people.map((person) => [
      person.id,
      { fullName: person.fullName, email: person.privateData?.email ?? null },
    ]),
  );
});

const studentIdKey = (stats: GroupStudentStats[]) =>
  [...new Set(stats.map((row) => row.userId))].sort().join(",");

export async function getGroupStudents(groupId: string): Promise<GroupStudent[]> {
  const stats = await fetchStudentStats(groupId);
  if (stats.length === 0) return [];

  const people = await fetchStudentPeople(studentIdKey(stats));

  return stats
    .map((row) => ({
      id: row.userId,
      fullName: people.get(row.userId)?.fullName ?? "",
      email: people.get(row.userId)?.email ?? null,
      gained: row.points.gained,
      total: row.points.total,
      hasLimit: row.hasLimit,
      passesLimit: row.passesLimit,
      solvedCount: row.assignments.filter((assignment) => assignment.status === "done").length,
      assignmentCount: row.assignments.length,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/**
 * The points matrix (T-006): every student against every assignment, one cell each.
 *
 * S-007's roster answers "how is this person doing overall" and deliberately stopped there; this
 * answers "who has not done which piece of work", which a teacher reads down the columns rather
 * than across the rows. **The cells come out of the same response** --
 * `/v1/groups/{id}/students/stats` already carries a row per student with a nested entry per
 * assignment -- and that read and the batched name lookup are memoized with the roster's, so a
 * Students tab showing both pays for neither twice. What the matrix adds on top is the assignment
 * *names* and the attempt counts below.
 *
 * Shadow assignments are **not** columns here. Their points are inside `points.gained` (core-api
 * folds them in, as S-025 found from the other side), so the row totals already count them, but
 * they have no per-assignment cell to show and inventing one would mean four blank columns --
 * DEC-079's reasoning, once more.
 *
 * **A cell distinguishes "never submitted" from "everything failed", which the stats alone cannot.**
 * A student whose every attempt died in the pipeline has `status: null` and no `bestSolutionId`,
 * exactly like a student who never started -- and a matrix that calls those the same thing is the
 * complaint Q-012 records about the dashboard. `/v1/assignment-solvers?groupId=` answers it for the
 * whole group in **one** call (`assignmentId` takes precedence when both are given, so the group
 * form is the batched one), which is the only reason this distinction is affordable here.
 */
export interface PointsMatrixCell {
  gained: number | null;
  total: number;
  /** core-api's four-value job state, or null when there is no valid best solution. */
  status: string | null;
  bestSolutionId: string | null;
  /** Attempts core-api counted, which is what tells "never started" from "every attempt failed". */
  attempts: number;
}

export interface PointsMatrixRow {
  userId: string;
  fullName: string;
  gained: number;
  total: number;
  cells: Record<string, PointsMatrixCell>;
}

export interface PointsMatrix {
  columns: { id: string; name: string; maxPoints: number; isBonus: boolean }[];
  rows: PointsMatrixRow[];
}

export async function getGroupPointsMatrix(groupId: string, locale: string): Promise<PointsMatrix> {
  const [stats, assignments, solvers] = await Promise.all([
    fetchStudentStats(groupId),
    apiRead<AssignmentPayload[]>("/v1/groups/{id}/assignments", { pathParams: { id: groupId } }),
    apiRead<{ assignmentId: string; solverId: string; lastAttemptIndex: number }[]>(
      "/v1/assignment-solvers",
      { query: { groupId } },
    ),
  ]);
  if (stats.length === 0) return { columns: [], rows: [] };

  const attempts = new Map(
    solvers.map((solver) => [`${solver.solverId}:${solver.assignmentId}`, solver.lastAttemptIndex]),
  );

  const people = await fetchStudentPeople(studentIdKey(stats));

  const columns = assignments
    .map((assignment) => ({
      id: assignment.id,
      name: localizedName(assignment.localizedTexts, locale),
      maxPoints: assignment.maxPointsBeforeFirstDeadline,
      isBonus: assignment.isBonus,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  const rows = stats
    .map((row) => ({
      userId: row.userId,
      fullName: people.get(row.userId)?.fullName ?? "",
      gained: row.points.gained,
      total: row.points.total,
      cells: Object.fromEntries(
        row.assignments.map((entry) => [
          entry.id,
          {
            gained: entry.points.gained,
            total: entry.points.total,
            status: entry.status,
            bestSolutionId: entry.bestSolutionId,
            attempts: attempts.get(`${row.userId}:${entry.id}`) ?? 0,
          },
        ]),
      ),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, locale));

  return { columns, rows };
}

/**
 * The same matrix as a file (T-007), which is the one thing this app builds for a reader to take
 * somewhere else.
 *
 * Three differences from what the screen shows, and each is because a spreadsheet is not a table
 * on a page. **Shadow assignments are columns here**: they carry points a teacher awarded by hand,
 * those points are inside every row total (core-api folds them in), and a file whose columns do
 * not add up to its own total column is a file someone will spend an afternoon disbelieving --
 * the screen can leave them out because it says so in words next to the table, a CSV cannot.
 * **Emails ride along** where core-api discloses them, because matching a row to a person in
 * another system is the reason to export at all; they cost no extra request, being in the same
 * `/v1/users/list` response the names come from. And **bonus points stay visible** as `8+2` rather
 * than being summed away, which is the legacy export's own notation.
 *
 * Raw `apiGet`/`apiPost` rather than `apiRead`: this is read by a Route Handler, where `forbidden()`
 * and friends are not answers a caller can read (`read.ts`'s own rule). The handler maps
 * `ApiError` to a status instead.
 */
export interface PointsExportColumn {
  id: string;
  name: string;
  maxPoints: number;
}

export interface PointsExportRow {
  fullName: string;
  /** Present only where core-api disclosed the person's private data to this reader. */
  email: string | null;
  gained: number;
  total: number;
  cells: Record<string, { gained: number | null; bonus: number | null }>;
  shadowCells: Record<string, number | null>;
}

export interface PointsExport {
  groupName: string;
  columns: PointsExportColumn[];
  shadowColumns: PointsExportColumn[];
  rows: PointsExportRow[];
}

interface ShadowPayload {
  id: string;
  localizedTexts?: LocalizedText[];
  maxPoints: number;
}

export async function getGroupPointsExport(groupId: string, locale: string): Promise<PointsExport> {
  const [group, stats, assignments, shadows] = await Promise.all([
    apiGet<GroupPayload>("/v1/groups/{id}", { pathParams: { id: groupId } }),
    apiGet<GroupStudentStats[]>("/v1/groups/{id}/students/stats", { pathParams: { id: groupId } }),
    apiGet<AssignmentPayload[]>("/v1/groups/{id}/assignments", { pathParams: { id: groupId } }),
    apiGet<ShadowPayload[]>("/v1/groups/{id}/shadow-assignments", { pathParams: { id: groupId } }),
  ]);

  const groupName = localizedName(group.localizedTexts, locale);
  const byName = (a: PointsExportColumn, b: PointsExportColumn) =>
    a.name.localeCompare(b.name, locale);

  const columns = assignments
    .map((assignment) => ({
      id: assignment.id,
      name: localizedName(assignment.localizedTexts, locale),
      maxPoints: assignment.maxPointsBeforeFirstDeadline,
    }))
    .sort(byName);
  const shadowColumns = shadows
    .map((shadow) => ({
      id: shadow.id,
      name: localizedName(shadow.localizedTexts, locale),
      maxPoints: shadow.maxPoints,
    }))
    .sort(byName);

  if (stats.length === 0) return { groupName, columns, shadowColumns, rows: [] };

  const people = await apiPost<
    { id: string; fullName: string; privateData?: { email?: string } }[]
  >("/v1/users/list", { ids: [...new Set(stats.map((row) => row.userId))] });
  const byId = new Map(people.map((person) => [person.id, person]));

  const rows = stats
    .map((row) => ({
      fullName: byId.get(row.userId)?.fullName ?? "",
      email: byId.get(row.userId)?.privateData?.email ?? null,
      gained: row.points.gained,
      total: row.points.total,
      cells: Object.fromEntries(
        row.assignments.map((entry) => [
          entry.id,
          { gained: entry.points.gained, bonus: entry.points.bonus },
        ]),
      ),
      shadowCells: Object.fromEntries(
        row.shadowAssignments.map((entry) => [entry.id, entry.points.gained]),
      ),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, locale));

  return { groupName, columns, shadowColumns, rows };
}

export interface GroupAttribute {
  id: string;
  service: string;
  key: string;
  value: string;
}

/**
 * External attributes an outside system (e.g. SIS) has attached to this group (G-012).
 * Returns an empty array when none exist or when the reader may not see them (403), so the
 * section is simply absent rather than erroring.
 */
export async function getGroupAttributes(groupId: string): Promise<GroupAttribute[]> {
  try {
    return await apiGet<GroupAttribute[]>("/v1/group-attributes/{groupId}", {
      pathParams: { groupId },
    });
  } catch (error) {
    if (error instanceof ApiError && (error.httpStatus === 403 || error.httpStatus === 404))
      return [];
    throw error;
  }
}
