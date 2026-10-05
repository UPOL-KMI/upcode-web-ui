"use client";

import { useTranslations } from "next-intl";

import type { AssignmentSolver } from "@/lib/api/assignment-solvers";
import { formatPoints, formatPointsUnknown } from "@/lib/format/points";
import { ASSIGNMENT_PROGRESS_TONE } from "@/lib/status/assignment-progress";

import { Link } from "@/i18n/navigation";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/status/badge";
import { BonusPoints } from "@/components/format/bonus-points";
import { Hint } from "@/components/status/hint";
import { buttonClasses } from "@/components/button";
import { PencilIcon } from "@/components/icons";

/**
 * Everyone the assignment was set for, and where each of them stands (S-013).
 *
 * Rows exist for students who have submitted nothing -- they are the reason a teacher opens this
 * at all -- so "no attempts" is a value in the table rather than an absence from it. Each name
 * leads to that person's own attempts at this assignment, which is the legacy
 * `/app/assignment/:id/user/:userId` screen, not their user profile.
 */
export function SolverTable({
  solvers,
  assignmentId,
}: {
  solvers: AssignmentSolver[];
  assignmentId: string;
}) {
  const t = useTranslations("Assignment.solvers");
  const status = useTranslations("Status");

  // Nobody accepted and nobody waiting on a review is the ordinary state of a fresh assignment,
  // and an always-present empty column reads as data that failed to load.
  const showFlags = solvers.some(
    (solver) => solver.accepted || solver.reviewRequested || !solver.member,
  );

  const columns: DataTableColumn<AssignmentSolver>[] = [
    {
      id: "name",
      header: t("columns.name"),
      sortable: true,
      sortValue: (solver) => solver.fullName,
      filterValue: (solver) => solver.fullName,
      cell: (solver) => (
        <Link
          href={`/assignments/${assignmentId}/users/${solver.userId}`}
          className="font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {solver.fullName || solver.userId}
        </Link>
      ),
    },
    {
      id: "attempts",
      header: t("columns.attempts"),
      align: "right" as const,
      className: "tabular-nums",
      sortable: true,
      sortValue: (solver) => solver.attempts,
      cell: (solver) =>
        solver.attempts === 0 ? <span className="text-muted-foreground">—</span> : solver.attempts,
    },
    {
      id: "points",
      header: t("columns.points"),
      align: "right" as const,
      className: "tabular-nums whitespace-nowrap",
      sortable: true,
      sortValue: (solver) => solver.gained ?? -1,
      cell: (solver) =>
        solver.gained === null ? (
          <span className="text-muted-foreground">—</span>
        ) : solver.progress === "awaiting-review" ? (
          // Nobody has marked it, so there is no number to show. The pipeline's nought is not the
          // student's score, and printing it here read as "0/20, wrong" beside a badge that says
          // the teacher has not looked yet.
          <span className="text-muted-foreground">{formatPointsUnknown(solver.maxPoints)}</span>
        ) : (
          <>
            {formatPoints(solver.gained, solver.maxPoints)}
            <BonusPoints bonus={solver.bonus} />
          </>
        ),
    },
    {
      id: "status",
      header: t("columns.status"),
      filterValue: (solver) => status(`evaluation.${solver.progress}.label`),
      cell: (solver) => (
        <span className="flex flex-wrap items-center gap-2">
          {/* The badge carried no description here while every other surface's did. */}
          <Hint text={status(`evaluation.${solver.progress}.description`)} plain>
            <Badge tone={ASSIGNMENT_PROGRESS_TONE[solver.progress]}>
              {status(`evaluation.${solver.progress}.label`)}
            </Badge>
          </Hint>
          {/* What the tests did, beside what the scoring made of it. */}
          {solver.tests && (
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              {status("evaluation.testsPassed", {
                passed: solver.tests.passed,
                total: solver.tests.total,
              })}
            </span>
          )}
        </span>
      ),
    },
    ...(showFlags
      ? [
          {
            id: "flags",
            header: t("columns.flags"),
            cell: (solver: AssignmentSolver) => (
              <div className="flex flex-wrap gap-1">
                {solver.accepted && <Badge tone="info">{t("flags.accepted")}</Badge>}
                {solver.reviewRequested && (
                  <Badge tone="warning">{t("flags.reviewRequested")}</Badge>
                )}
                {!solver.member && <Badge>{t("flags.notMember")}</Badge>}
              </div>
            ),
          },
        ]
      : []),
    // X-031: straight to the files of the solution that counts, with the class queue around it.
    // Rows without a best solution have nothing to open -- a student who never submitted, or one
    // whose every attempt failed -- and the queue skips them for the same reason.
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      align: "right" as const,
      cell: (solver: AssignmentSolver) =>
        solver.bestSolutionId === null ? null : (
          <Link
            href={`/solutions/${solver.bestSolutionId}/sources?grade=1`}
            aria-label={t("gradeNamed", { name: solver.fullName || solver.userId })}
            className={buttonClasses("primary", "xs", "whitespace-nowrap")}
          >
            <PencilIcon className="size-3.5" />
            {t("grade")}
          </Link>
        ),
    },
  ];

  return (
    <DataTable
      id={`solvers-${assignmentId.slice(0, 8)}`}
      columns={columns}
      data={solvers}
      getRowId={(solver) => solver.userId}
      caption={t("caption")}
      filterPlaceholder={t("filterPlaceholder")}
    />
  );
}
