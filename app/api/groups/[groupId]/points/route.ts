import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { ApiError } from "@/lib/api/client";
import {
  getGroupPointsExport,
  type PointsExportColumn,
  type PointsExportRow,
} from "@/lib/api/group-detail";
import { csvDocument, csvFileName, type CsvValue } from "@/lib/format/csv";

import { routing } from "@/i18n/routing";

/**
 * The points matrix as a file (T-007).
 *
 * A Route Handler rather than a button that builds the file in the browser, which is what the
 * legacy app does. Three reasons, in order of how much they matter: the link works with no
 * JavaScript and can be bookmarked or curl'd; the numbers are re-read from core-api at the moment
 * of the download, so a file dated today holds today's points rather than whatever the page was
 * rendered with an hour ago; and the reader's own permission is re-checked by core-api on that
 * read, which is the honest boundary -- a hidden button is not authorisation (brief §3.4).
 *
 * `locale` comes in as a query parameter and is checked against `routing.locales`, because the
 * assignment names in the header row are localised and this path has no locale segment of its own
 * to read one from (`/api/...` is excluded from `proxy.ts`'s matcher, so next-intl never sees it).
 *
 * core-api's refusals are forwarded as statuses rather than mapped to pages: `read.ts`'s rule is
 * that `forbidden()` and its siblings belong on a render path, and a browser following a download
 * link is better served by a 403 than by an HTML page with the wrong content type.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params;
  const requested = request.nextUrl.searchParams.get("locale");
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  let data;
  try {
    data = await getGroupPointsExport(groupId, locale);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    }
    throw error;
  }

  const t = await getTranslations({ locale, namespace: "Group.points.export" });
  // The totals leave hidden work out (DEC-165), so the header says which columns those are.
  const columnName = (column: PointsExportColumn) =>
    column.hidden ? t("hiddenColumn", { name: column.name }) : column.name;

  const header: CsvValue[] = [
    t("student"),
    t("email"),
    t("gained"),
    t("maximum"),
    ...data.columns.map((column) => columnName(column)),
    ...data.shadowColumns.map((column) => columnName(column)),
  ];

  const rows: CsvValue[][] = [
    header,
    ...data.rows.map((row) => [
      row.fullName,
      row.email,
      row.gained,
      row.total,
      ...data.columns.map((column) => cell(row, column.id)),
      ...data.shadowColumns.map((column) => row.shadowCells[column.id] ?? null),
    ]),
  ];

  const fileName = csvFileName(data.groupName, "group-points");
  return new NextResponse(csvDocument(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // Two forms of the same name: a header carries latin-1, and group names here are Czech.
      // Browsers that understand RFC 5987's `filename*` use it; the rest get a transliterated
      // fallback rather than a mangled one.
      "Content-Disposition":
        `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, "_")}"; ` +
        `filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * One assignment's cell, in the legacy export's own notation: `8`, or `8+2` where bonus points
 * were awarded on top, or `8-1` where they were taken off. Empty when nothing has been scored --
 * the same distinction the matrix draws with a dash, and for the same reason: a zero here would
 * claim the student submitted something worth nothing.
 */
function cell(row: PointsExportRow, assignmentId: string): CsvValue {
  const points = row.cells[assignmentId];
  if (!points || points.gained === null) return null;
  const bonus = points.bonus ?? 0;
  if (bonus === 0) return points.gained;
  return `${points.gained}${bonus > 0 ? "+" : ""}${bonus}`;
}
