/**
 * Reading a list of people out of a pasted table, for the bulk import (AD-009).
 *
 * **A header row is required, and it is what makes the format extensible.** Five column names are
 * understood as parts of a person; *every other column becomes an identifier*, keyed by the header
 * as written. So a sheet exported from STAG with a `stag` column records a `stag` identifier, and a
 * faculty that also tracks something else adds a column rather than waiting for this file to learn
 * about it. That is the same key-value shape core-api stores
 * (`POST /v1/users/{id}/external-login/{service}`), which is why it costs nothing here.
 *
 * The header names are matched loosely -- case, spaces, underscores and Czech diacritics are all
 * stripped before comparison -- because the column is going to be typed by a person, not generated.
 * The identifier key, though, is kept exactly as it was written: it is a value core-api stores, not
 * a word this file interprets.
 */
export interface RosterRow {
  email: string;
  firstName: string;
  lastName: string;
  titlesBeforeName: string;
  titlesAfterName: string;
  /** Header name → identifier, for every column that is not one of the five above. */
  externalIds: Record<string, string>;
}

export interface RosterProblem {
  /** One-based, counting the header as line 1, so it matches what the reader sees. */
  line: number;
  reason: "email" | "name" | "columns" | "duplicate";
}

export interface ParsedRoster {
  rows: RosterRow[];
  problems: RosterProblem[];
  /** Header names that became identifier keys, in the order they appear. */
  identifierKeys: string[];
}

/** A person's own fields, and the header spellings each answers to once normalised. */
export const PERSON_COLUMNS: Record<keyof Omit<RosterRow, "externalIds">, readonly string[]> = {
  email: ["email", "mail", "eemail", "emailovaadresa", "adresa"],
  firstName: ["firstname", "jmeno", "krestnijmeno", "given", "givenname"],
  lastName: ["lastname", "prijmeni", "surname", "family", "familyname"],
  titlesBeforeName: ["titlesbeforename", "titulpred", "titulypred", "tituly", "titul"],
  titlesAfterName: ["titlesaftername", "titulza", "titulyza"],
};

/** Lower-cased, stripped of diacritics and of anything that is not a letter or a digit.
 *  Exported because `lib/users/column-map.ts` has to recognise the *same* headers this does --
 *  a file reader that disagreed with the parser about what `titul před` means would drop a column
 *  the parser was waiting for. */
export function normaliseHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * The delimiter is guessed from the header line rather than configured: a tab beats a semicolon
 * beats a comma, which is the order of how unambiguous they are. **The comma is last on purpose** —
 * Czech academic titles are full of them (`Ph.D., MBA`), so a file that uses commas as data is
 * likelier than one that uses them as structure, and a semicolon-delimited export from Excel is
 * what a Czech locale produces anyway.
 */
function guessDelimiter(headerLine: string): string {
  for (const candidate of ["\t", ";"]) {
    if (headerLine.includes(candidate)) return candidate;
  }
  return ",";
}

/**
 * Splits one line into fields, honouring double quotes so a quoted title keeps its comma. `""`
 * inside a quoted field is a literal quote, as every spreadsheet writes it.
 */
function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    if (quoted) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      fields.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  fields.push(current);
  return fields.map((field) => field.trim());
}

/** Deliberately loose: core-api validates the address, and this only catches a shifted column. */
const PLAUSIBLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRoster(text: string): ParsedRoster {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return { rows: [], problems: [], identifierKeys: [] };

  const delimiter = guessDelimiter(lines[0]!);
  const headers = splitLine(lines[0]!, delimiter);

  // header index → which person field it fills, or the identifier key it carries
  const fields = new Map<number, keyof Omit<RosterRow, "externalIds">>();
  const identifiers = new Map<number, string>();
  for (const [index, header] of headers.entries()) {
    if (header === "") continue;
    const normalised = normaliseHeader(header);
    const match = (Object.keys(PERSON_COLUMNS) as (keyof Omit<RosterRow, "externalIds">)[]).find(
      (field) => PERSON_COLUMNS[field].includes(normalised),
    );
    if (match !== undefined && !fields.has(index)) {
      fields.set(index, match);
    } else {
      identifiers.set(index, header);
    }
  }

  const named = new Set(fields.values());
  const rows: RosterRow[] = [];
  const problems: RosterProblem[] = [];

  if (!named.has("email") || !named.has("firstName") || !named.has("lastName")) {
    return { rows: [], problems: [{ line: 1, reason: "columns" }], identifierKeys: [] };
  }

  const seen = new Set<string>();
  for (const [offset, line] of lines.slice(1).entries()) {
    const cells = splitLine(line, delimiter);
    const value = (index: number) => (cells[index] ?? "").trim();

    const row: RosterRow = {
      email: "",
      firstName: "",
      lastName: "",
      titlesBeforeName: "",
      titlesAfterName: "",
      externalIds: {},
    };
    for (const [index, field] of fields) row[field] = value(index);
    for (const [index, key] of identifiers) {
      const identifier = value(index);
      if (identifier !== "") row.externalIds[key] = identifier;
    }

    const at = offset + 2;
    if (!PLAUSIBLE_EMAIL.test(row.email)) {
      problems.push({ line: at, reason: "email" });
      continue;
    }
    if (row.firstName === "" || row.lastName === "") {
      problems.push({ line: at, reason: "name" });
      continue;
    }
    const key = row.email.toLowerCase();
    if (seen.has(key)) {
      problems.push({ line: at, reason: "duplicate" });
      continue;
    }
    seen.add(key);
    rows.push(row);
  }

  return { rows, problems, identifierKeys: [...identifiers.values()] };
}

/**
 * Above this many rows one run outlives the proxy's own read timeout, so the screen refuses and
 * asks for the paste to be split. It is a limit of doing a hundred round trips in one request,
 * not of anything core-api says.
 */
export const MAX_ROWS = 200;

/** What became of one row. Lives here rather than beside the action, because a `"use server"`
 *  module may export nothing but async functions. */
export interface ImportOutcome {
  email: string;
  /**
   * `invited` -- mail sent, and the identifiers ride along in the token, so the account arrives
   * complete. `added` -- the account already existed and has now been put into the group.
   * `matched` -- the account existed and was already a member, so only identifiers were touched.
   * `skipped` -- no account, and this was a dry run. `failed` -- nothing happened, and `reason`
   * says why.
   *
   * **`added` and `matched` used to be one state, and that was a defect** rather than a
   * simplification: an existing account was reported as handled and never actually joined the
   * group. In a second-year cohort, where most people already have an account, that meant an
   * import which looked entirely successful and put almost nobody in the course.
   */
  state: "invited" | "added" | "matched" | "skipped" | "failed";
  /** Services whose identifier was written, or will be written when the invitation is accepted. */
  identifiersSet: string[];
  /** Services whose identifier was refused, with core-api's own code and, for a clash, the
   *  address of whoever holds it. `forbidden` is the ordinary one: only an administrator may write
   *  an identifier onto an account that already exists. */
  identifiersFailed: { service: string; code: string; owner?: string }[];
  /** core-api's own sentence, shown as it came. */
  reason?: string;
  /** A refusal this app has words of its own for, preferred over `reason` when both are set. */
  reasonCode?: "emailTaken";
}
