"use client";

import { useTranslations } from "next-intl";

import type { GroupStanding } from "@/lib/api/group-detail";
import { formatPoints } from "@/lib/format/points";

import { Link } from "@/i18n/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/status/badge";
import { Hint } from "@/components/status/hint";

/**
 * The group's roster (S-007): one row per student, with where they stand -- as the student sees
 * it, hidden work left out (X-032, DEC-165).
 *
 * Sorted by points descending by default is *not* what this does -- it sorts by name, and the
 * points column is sortable if that is what the reader wants. A roster that opens ranked is a
 * leaderboard, which is a different thing to hand a teacher by default, and ReCodEx's own group
 * settings treat "students can see each other's progress" as a decision a course makes rather than
 * an assumption.
 */
export function StudentTable({
  students,
  groupId,
  viewerId,
  staffView,
}: {
  students: GroupStanding[];
  groupId: string;
  viewerId: string;
  /** The reader administers, supervises or observes this group. */
  staffView: boolean;
}) {
  const t = useTranslations("Group.students");

  const showThreshold = students.some((student) => student.hasLimit);
  const showGraded = students.some((student) => student.graded !== null);

  const columns: DataTableColumn<GroupStanding>[] = [
    {
      id: "name",
      header: t("columns.name"),
      sortable: true,
      sortValue: (student) => student.fullName,
      filterValue: (student) => student.fullName,
      cell: (student) => (
        <Link
          href={`/users/${student.id}`}
          className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {student.fullName || student.id}
        </Link>
      ),
    },
    {
      id: "points",
      header: t("columns.points"),
      align: "right" as const,
      className: "tabular-nums",
      sortable: true,
      sortValue: (student) => student.gained,
      cell: (student) => formatPoints(student.gained, student.total),
    },
    {
      id: "submitted",
      header: t("columns.submitted"),
      align: "right" as const,
      className: "tabular-nums",
      sortable: true,
      sortValue: (student) => student.submitted,
      cell: (student) => `${student.submitted}/${student.submittable}`,
    },
    ...(showGraded
      ? [
          {
            id: "graded",
            header: t("columns.graded"),
            align: "right" as const,
            className: "tabular-nums",
            sortable: true,
            sortValue: (student: GroupStanding) => student.graded ?? -1,
            cell: (student: GroupStanding) =>
              student.graded === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                `${student.graded}/${student.gradable}`
              ),
          },
        ]
      : []),
    {
      id: "solutions",
      // Named, like every other action column in the app (`Users`, `SystemMessages`, the licence
      // and job tables). It was blank on the legacy roster's example, which left the one column
      // carrying a control with nothing above it.
      header: t("columns.actions"),
      // T-005's drill-down, offered by the legacy roster's own rule: staff may read anyone's
      // submissions in their group, a student only their own. There is no permission hint to ask
      // -- `viewStudentStats` is written against two subjects, group *and* student, so core-api
      // computes none for the group alone (DEC-090's shape) -- so the ACL's own condition
      // (`student.isSameUser`) is restated here and core-api decides for real on the page.
      cell: (student) =>
        staffView || student.id === viewerId ? (
          <Link
            href={`/groups/${groupId}/users/${student.id}`}
            className="inline-flex items-center rounded-full border border-warning px-2 py-0.5 text-xs font-medium whitespace-nowrap text-warning outline-none hover:bg-warning/10 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("viewSolutions")}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    ...(showThreshold
      ? [
          {
            id: "threshold",
            header: t("columns.threshold"),
            sortable: true,
            sortValue: (student: GroupStanding) => (student.passesLimit ? 1 : 0),
            cell: (student: GroupStanding) =>
              student.hasLimit ? (
                // The badge says where somebody stands *today*, and nothing on the screen said
                // so -- a teacher reading "Pod hranicí" mid-term could take it for a verdict.
                <Hint text={t("thresholdExplain")}>
                  <Badge tone={student.passesLimit ? "success" : "warning"}>
                    {student.passesLimit ? t("passes") : t("belowLimit")}
                  </Badge>
                </Hint>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
        ]
      : []),
  ];

  return (
    <DataTable
      id={`students-${groupId.slice(0, 8)}`}
      columns={columns}
      data={students}
      getRowId={(student) => student.id}
      caption={t("caption")}
      filterPlaceholder={t("filterPlaceholder")}
    />
  );
}
