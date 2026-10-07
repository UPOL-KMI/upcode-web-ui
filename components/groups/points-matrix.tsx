import { getTranslations } from "next-intl/server";

import {
  POINTS_FILTERS,
  type PointsFilter,
  type PointsMatrix,
  type PointsMatrixColumn,
  type PointsMatrixRow,
} from "@/lib/api/group-detail";
import { formatPoints } from "@/lib/format/points";

import { Link } from "@/i18n/navigation";

/**
 * Every student against every assignment (T-006), which S-007's roster deliberately left out.
 *
 * A teacher reads this **down the columns** -- who has not done this piece of work -- where the
 * roster answers the row question, how one person is doing overall. That is why this is a plain
 * table rather than a `DataTable`: its columns are data, not a fixed schema, so sorting by one of
 * them would mean sorting by a column that may not exist tomorrow, and a filter box over a matrix
 * hides the shape that makes it readable.
 *
 * A cell that was never submitted is an em dash, not a zero. The difference between "scored zero"
 * and "has not started" is the whole point of looking at this, and a grid of zeroes states the
 * first about everyone doing the second. **A third state sits between them**: a student whose every
 * attempt died in the pipeline has no score and no best solution either, and calling that "nothing
 * submitted" is the complaint Q-012 records about the dashboard -- so it says so instead. Where a
 * solution exists, the cell links to it.
 *
 * Wide by nature -- one column per assignment -- so the table scrolls inside its own container and
 * the name column stays put while it does.
 *
 * The filter (X-032) is links, like the assignment list's: it lives in the URL and needs no
 * JavaScript. A hidden column is dimmed and labelled; the total never counts it (DEC-165).
 */
export async function PointsMatrixTable({
  matrix,
  filter,
  groupId,
}: {
  matrix: PointsMatrix;
  filter: PointsFilter;
  groupId: string;
}) {
  const t = await getTranslations("Group.points");
  const hasShadows = matrix.columns.some((column) => column.kind === "shadow");
  const columns = matrix.columns.filter(
    (column) => filter === "all" || (filter === "shadow") === (column.kind === "shadow"),
  );

  return (
    <div className="flex flex-col gap-2">
      {hasShadows && (
        <nav aria-label={t("filter.label")} className="flex flex-wrap gap-2">
          {POINTS_FILTERS.map((option) => {
            const active = option === filter;
            return (
              <Link
                key={option}
                href={`/groups/${groupId}?tab=students&points=${option}`}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={`rounded-full px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`filter.${option}`)}
              </Link>
            );
          })}
        </nav>
      )}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t("caption")}</caption>
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium"
              >
                {t("columns.student")}
              </th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={`px-3 py-2 text-right font-medium ${column.hidden ? "text-muted-foreground" : ""}`}
                >
                  <Link
                    href={
                      column.kind === "shadow"
                        ? `/shadow-assignments/${column.id}`
                        : `/assignments/${column.id}`
                    }
                    className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {column.name || t("untitled")}
                  </Link>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {column.kind === "shadow" && `${t("shadow")} · `}
                    {column.isBonus ? t("bonusOf", { max: column.maxPoints }) : column.maxPoints}
                    {column.hidden && ` · ${t("hidden")}`}
                  </span>
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t("columns.total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr
                key={row.userId}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-medium"
                >
                  <Link
                    href={`/users/${row.userId}`}
                    className="hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {row.fullName || row.userId}
                  </Link>
                </th>
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`px-3 py-2 text-right whitespace-nowrap tabular-nums ${column.hidden ? "opacity-60" : ""}`}
                  >
                    <MatrixCell row={row} column={column} t={t} />
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums">
                  {formatPoints(row.totals[filter].gained, row.totals[filter].total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatrixCell({
  row,
  column,
  t,
}: {
  row: PointsMatrixRow;
  column: PointsMatrixColumn;
  t: Awaited<ReturnType<typeof getTranslations<"Group.points">>>;
}) {
  const link =
    "hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  if (column.kind === "shadow") {
    const points = row.shadowCells[column.id] ?? null;
    return (
      <Link href={`/shadow-assignments/${column.id}`} className={link}>
        {points === null ? (
          <span className="text-muted-foreground">
            <span aria-hidden="true">—</span>
            <span className="sr-only">{t("notGraded")}</span>
          </span>
        ) : (
          points
        )}
      </Link>
    );
  }

  const cell = row.cells[column.id];
  const nothing = !cell || cell.bestSolutionId === null;
  const onlyFailures = nothing && (cell?.attempts ?? 0) > 0;
  if (nothing) {
    return (
      <span className={onlyFailures ? "text-destructive" : "text-muted-foreground"}>
        <span aria-hidden="true">{onlyFailures ? "!" : "—"}</span>
        <span className="sr-only">
          {onlyFailures ? t("allFailed", { attempts: cell?.attempts ?? 0 }) : t("notSubmitted")}
        </span>
      </span>
    );
  }
  return (
    <Link href={`/solutions/${cell.bestSolutionId}`} className={link}>
      {cell.gained ?? 0}
      {/* The export's notation (`8+2`, `8-1`): the bonus is in the total, so it is in the cell. */}
      {cell.bonus !== 0 && (
        <span className={cell.bonus > 0 ? "text-success" : "text-destructive"}>
          {cell.bonus > 0 ? "+" : ""}
          {cell.bonus}
        </span>
      )}
    </Link>
  );
}
