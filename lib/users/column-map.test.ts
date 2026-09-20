import { describe, expect, it } from "vitest";

import { ColumnMapError, mapSpreadsheet } from "./column-map";
import { parseRoster } from "./import-roster";

/**
 * The narrowing step (X-015). The header row below is the real one from a STAG
 * `getStudentiByPredmet` export, all thirty-six columns of it, because the thing being tested is
 * precisely what happens to the thirty this import has no use for.
 */
const STAG_HEADER = [
  "osCislo",
  "jmeno",
  "prijmeni",
  "titulPred",
  "titulZa",
  "stav",
  "userName",
  "stprIdno",
  "nazevSp",
  "fakultaSp",
  "kodSp",
  "formaSp",
  "typSp",
  "typSpKey",
  "mistoVyuky",
  "rocnik",
  "financovani",
  "oborKomb",
  "oborIdnos",
  "email",
  "maxDobaDatum",
  "simsP58",
  "simsP59",
  "cisloKarty",
  "pohlavi",
  "rozvrhovyKrouzek",
  "studijniKruh",
  "evidovanBankovniUcet",
  "studReferentkaUsername",
  "studReferentkaUcitidno",
  "studReferentkaEmail",
  "studReferentkaTelefon",
  "studReferentkaPrijmeniJmeno",
  "planovaneOdevzdaniVSKPText",
  "statutPredmetu",
  "casPrihlaseni",
];

function stagRow(overrides: Partial<Record<string, string>> = {}): string[] {
  const values: Record<string, string> = {
    osCislo: "R25238",
    jmeno: "Lukáš",
    prijmeni: "BENEŠ",
    stav: "S",
    userName: "benelu09",
    fakultaSp: "PRF",
    email: "lukas.benes01@upol.cz",
    casPrihlaseni: "46212.4597222222",
    ...overrides,
  };
  return STAG_HEADER.map((header) => values[header] ?? "");
}

describe("mapSpreadsheet", () => {
  it("keeps the six columns a person is made of and drops the other thirty", () => {
    const result = mapSpreadsheet([STAG_HEADER, stagRow()]);

    expect(result.kept).toEqual(["stag", "jmeno", "prijmeni", "titulPred", "titulZa", "email"]);
    expect(result.ignored).toHaveLength(30);
    expect(result.ignored).toContain("stav");
    expect(result.ignored).toContain("userName");
    expect(result.ignored).toContain("studReferentkaEmail");
    expect(result.rows).toBe(1);
  });

  it("produces something parseRoster reads back as one person with a stag identifier", () => {
    const { text } = mapSpreadsheet([STAG_HEADER, stagRow()]);
    const { rows, problems, identifierKeys } = parseRoster(text);

    expect(problems).toEqual([]);
    expect(identifierKeys).toEqual(["stag"]);
    expect(rows).toEqual([
      {
        email: "lukas.benes01@upol.cz",
        firstName: "Lukáš",
        lastName: "Beneš",
        titlesBeforeName: "",
        titlesAfterName: "",
        externalIds: { stag: "R25238" },
      },
    ]);
  });

  it("reports the surnames it took out of capitals", () => {
    const result = mapSpreadsheet([STAG_HEADER, stagRow(), stagRow({ prijmeni: "Dvořák" })]);
    expect(result.recased).toEqual(["BENEŠ → Beneš"]);
  });

  it("finds a header that is not on the first row", () => {
    const result = mapSpreadsheet([
      ["Seznam studentů předmětu KMI/ALG1"],
      [],
      STAG_HEADER,
      stagRow(),
    ]);
    expect(result.rows).toBe(1);
    expect(result.kept).toContain("email");
  });

  it("skips the blank rows a spreadsheet leaves under the data", () => {
    const result = mapSpreadsheet([STAG_HEADER, stagRow(), STAG_HEADER.map(() => "")]);
    expect(result.rows).toBe(1);
  });

  it("reads a hand-made sheet with Czech headers and no identifier column", () => {
    const result = mapSpreadsheet([
      ["E-mail", "Jméno", "Příjmení", "Titul před", "Titul za"],
      ["novak@upol.cz", "Jan", "Novák", "Bc.", "DiS."],
    ]);

    expect(result.kept).toEqual(["email", "jmeno", "prijmeni", "titulPred", "titulZa"]);
    expect(result.ignored).toEqual([]);
    expect(parseRoster(result.text).rows[0]?.externalIds).toEqual({});
  });

  it("quotes a cell carrying a tab, so it cannot invent a column", () => {
    const { text } = mapSpreadsheet([
      ["email", "jmeno", "prijmeni"],
      ["a@b.cz", "Jan", "No\tvák"],
    ]);
    expect(parseRoster(text).rows[0]?.lastName).toBe("No\tvák");
  });

  it("takes the first of two columns claiming the same field and ignores the second", () => {
    const result = mapSpreadsheet([
      ["email", "mail", "jmeno", "prijmeni"],
      ["first@upol.cz", "second@upol.cz", "Jan", "Novák"],
    ]);

    expect(result.ignored).toEqual(["mail"]);
    expect(parseRoster(result.text).rows[0]?.email).toBe("first@upol.cz");
  });

  it("refuses a sheet with no recognisable header rather than importing nonsense", () => {
    expect(() =>
      mapSpreadsheet([
        ["a", "b"],
        ["1", "2"],
      ]),
    ).toThrow(ColumnMapError);
  });

  it("refuses a sheet that has names but no e-mail column, since e-mail is the key", () => {
    expect(() =>
      mapSpreadsheet([
        ["jmeno", "prijmeni"],
        ["Jan", "Novák"],
      ]),
    ).toThrow(ColumnMapError);
  });
});
