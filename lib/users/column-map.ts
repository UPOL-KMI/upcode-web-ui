/**
 * Turning a spreadsheet a study information system produced into the table the import reads
 * (X-015).
 *
 * **Only the columns this file knows survive.** That inversion is the whole point. `parseRoster`
 * treats any header it does not recognise as an *identifier* to be recorded against the person,
 * which is exactly right for a table somebody typed by hand with a `stag` column on the end — and
 * exactly wrong for a STAG export, which carries **thirty-six** columns. Thirty of them would
 * become identifiers; `stav` is `S` for every student in the file and identifiers are unique per
 * service, so the second row would collide with the first and every row after it would report
 * thirty failures. The export is a database dump, not a roster, and it has to be narrowed to one
 * before the parser ever sees it.
 *
 * What comes out is a tab-separated table, which is the format `guessDelimiter` picks first and
 * the one delimiter that cannot appear inside a Czech academic title.
 *
 * The result is put in front of the teacher in the import's own text box rather than sent
 * anywhere, so every decision here — which columns were kept, which were dropped, and what a
 * shouted surname was turned into — is visible and can be typed over before anything is written.
 */
import { fixShoutedName } from "./name-case";
import { normaliseHeader, PERSON_COLUMNS } from "./import-roster";
import type { Grid } from "./spreadsheet";

export interface MappedRoster {
  /** Tab-separated, header first: exactly what `parseRoster` expects. */
  text: string;
  /** Headers that were kept, in output order. */
  kept: string[];
  /** Headers that were dropped, in the order the file had them. */
  ignored: string[];
  /** How many data rows were carried over. */
  rows: number;
  /** Surnames and given names that were rewritten out of capitals, as `BEFORE → After`. */
  recased: string[];
}

/** Nothing recognised, or no header row at all. */
export class ColumnMapError extends Error {
  constructor(readonly reason: "noHeader") {
    super(reason);
    this.name = "ColumnMapError";
  }
}

/**
 * Identifier columns, as opposed to the five person columns `PERSON_COLUMNS` already names.
 *
 * The key on the left is what a file might call it; the value is the **service name** the
 * identifier is stored under (`ExternalLogin.authService`). They differ on purpose: `osCislo` is
 * STAG's word for the column, `stag` is the name of the system that issued the number, and it is
 * the second that has to be stable — it is what `GET /v1/users/external-login/{service}/{id}` is
 * asked for, and what an SSO integration would one day match on.
 */
const IDENTIFIER_COLUMNS: Record<string, string> = {
  oscislo: "stag",
  osobnicislo: "stag",
  stag: "stag",
};

/** Columns whose value is a person's name, and therefore worth repairing when it is shouted. */
const NAME_FIELDS = new Set(["firstName", "lastName"]);

const OUTPUT_HEADERS: Record<string, string> = {
  email: "email",
  firstName: "jmeno",
  lastName: "prijmeni",
  titlesBeforeName: "titulPred",
  titlesAfterName: "titulZa",
};

/** How far down to look for the header. An export with a title line above the table is ordinary;
 *  one with ten is not a table. */
const HEADER_SEARCH_DEPTH = 10;

interface Column {
  index: number;
  /** The header as the file wrote it, for the report. */
  header: string;
  /** A key of `PERSON_COLUMNS`, or `identifier:<service>`. */
  target: string;
}

function classify(header: string): string | null {
  const normalised = normaliseHeader(header);
  if (normalised === "") return null;

  const person = (Object.keys(PERSON_COLUMNS) as (keyof typeof PERSON_COLUMNS)[]).find((field) =>
    PERSON_COLUMNS[field].includes(normalised),
  );
  if (person !== undefined) return person;

  const service = IDENTIFIER_COLUMNS[normalised];
  return service === undefined ? null : `identifier:${service}`;
}

/**
 * The header is the first row that carries an e-mail column **and** a name column.
 *
 * Both, not either: `jmeno` alone also matches the word a title line might use, and an e-mail
 * column alone appears in the data of a file whose header this has already passed. Requiring the
 * pair is what lets the search run down ten rows without ever landing on one of them.
 */
function findHeader(grid: Grid): { row: number; columns: Column[] } | null {
  for (let row = 0; row < Math.min(grid.length, HEADER_SEARCH_DEPTH); row += 1) {
    const cells = grid[row] ?? [];
    const columns: Column[] = [];
    const taken = new Set<string>();

    for (const [index, header] of cells.entries()) {
      const target = classify(header);
      if (target === null || taken.has(target)) continue;
      taken.add(target);
      columns.push({ index, header: header.trim(), target });
    }

    if (taken.has("email") && (taken.has("firstName") || taken.has("lastName"))) {
      return { row, columns };
    }
  }
  return null;
}

export function mapSpreadsheet(grid: Grid): MappedRoster {
  const found = findHeader(grid);
  if (found === null) throw new ColumnMapError("noHeader");

  const { row: headerRow, columns } = found;
  const known = new Set(columns.map((column) => column.index));
  const ignored = (grid[headerRow] ?? [])
    .map((header, index) => ({ header: header.trim(), index }))
    .filter(({ header, index }) => header !== "" && !known.has(index))
    .map(({ header }) => header);

  const kept = columns.map((column) =>
    column.target.startsWith("identifier:")
      ? column.target.slice("identifier:".length)
      : (OUTPUT_HEADERS[column.target] ?? column.target),
  );

  const recased: string[] = [];
  const lines: string[] = [kept.join("\t")];

  for (const cells of grid.slice(headerRow + 1)) {
    const values = columns.map((column) => {
      const raw = (cells[column.index] ?? "").trim();
      if (!NAME_FIELDS.has(column.target)) return raw;
      const fixed = fixShoutedName(raw);
      if (fixed !== raw) recased.push(`${raw} → ${fixed}`);
      return fixed;
    });

    // A row with nothing in it is the blank line a spreadsheet leaves below the data, not a person.
    if (values.every((value) => value === "")) continue;
    lines.push(values.map(escapeField).join("\t"));
  }

  return { text: lines.join("\n"), kept, ignored, rows: lines.length - 1, recased };
}

/** A tab or a newline inside a cell would invent a column or a row, so such a cell is quoted the
 *  way `splitLine` in `import-roster.ts` reads it back. */
function escapeField(value: string): string {
  if (!/[\t\n\r"]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
