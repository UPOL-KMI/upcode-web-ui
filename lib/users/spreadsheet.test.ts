import { describe, expect, it } from "vitest";

import { readSpreadsheet, SpreadsheetError } from "./spreadsheet";

/**
 * The roster reader (X-015). Every fixture here is **built byte by byte in the test** rather than
 * committed as a file, for two reasons: the export that prompted this work carries a real
 * student's name, address and study number, which is not something to put in a repository; and a
 * binary fixture tells nobody what it is testing, whereas a builder that writes a `CONTINUE`
 * boundary in the middle of a string names the case in its own code.
 *
 * The reader has been run against the operator's actual STAG export as well -- 36 columns, one
 * row, read correctly -- which is the check these fixtures cannot make.
 */

const encoder = new TextEncoder();

function toBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function fromText(text: string): ArrayBuffer {
  return toBuffer(encoder.encode(text));
}

/* ------------------------------------------------------------------------ delimited and HTML */

describe("readSpreadsheet, delimited text", () => {
  it("reads a semicolon-separated export, which is what a Czech Excel writes", async () => {
    const grid = await readSpreadsheet(fromText("email;jmeno;prijmeni\na@b.cz;Jan;Novák\n"));
    expect(grid).toEqual([
      ["email", "jmeno", "prijmeni"],
      ["a@b.cz", "Jan", "Novák"],
    ]);
  });

  it("prefers a tab over a semicolon, and keeps a comma that is inside quotes", async () => {
    const grid = await readSpreadsheet(fromText('a\tb\n"x, y"\t"he said ""no"""'));
    expect(grid).toEqual([
      ["a", "b"],
      ["x, y", 'he said "no"'],
    ]);
  });

  it("falls back to Windows-1250 when the bytes are not valid UTF-8", async () => {
    // "Beneš" in cp1250: the 0x9A is not a legal UTF-8 sequence, so strict decoding throws.
    const grid = await readSpreadsheet(toBuffer(new Uint8Array([0x42, 0x65, 0x6e, 0x65, 0x9a])));
    expect(grid).toEqual([["Beneš"]]);
  });

  it("drops a byte-order mark rather than gluing it to the first header", async () => {
    const grid = await readSpreadsheet(fromText("﻿email;jmeno\na@b.cz;Jan"));
    expect(grid[0]).toEqual(["email", "jmeno"]);
  });
});

describe("readSpreadsheet, HTML table", () => {
  it("reads a table served under an .xls name, entities and all", async () => {
    const grid = await readSpreadsheet(
      fromText(
        "<html><body><table>" +
          "<tr><th>email</th><th>prijmeni</th></tr>" +
          "<tr><td>a&amp;b@upol.cz</td><td>BENE&#352;</td></tr>" +
          "</table></body></html>",
      ),
    );
    expect(grid).toEqual([
      ["email", "prijmeni"],
      ["a&b@upol.cz", "BENEŠ"],
    ]);
  });
});

describe("readSpreadsheet, shape of the result", () => {
  it("trims the trailing empty rows and columns a formatted sheet carries", async () => {
    const grid = await readSpreadsheet(fromText("a;b;;\nc;d;;\n;;;\n"));
    expect(grid).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("refuses an empty file with a reason rather than an empty grid", async () => {
    await expect(readSpreadsheet(fromText("\n\n"))).rejects.toBeInstanceOf(SpreadsheetError);
  });
});

/* ---------------------------------------------------------------------------------- OOXML zip */

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A real, if minimal, zip: local headers, a central directory and an end record. */
async function buildZip(files: Record<string, string>): Promise<ArrayBuffer> {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const raw = encoder.encode(content);
    const deflated = await deflateRaw(raw);

    const header = new Uint8Array(30 + nameBytes.length);
    const headerView = new DataView(header.buffer);
    headerView.setUint32(0, 0x04034b50, true);
    headerView.setUint16(8, 8, true); // deflate
    headerView.setUint32(18, deflated.length, true);
    headerView.setUint32(22, raw.length, true);
    headerView.setUint16(26, nameBytes.length, true);
    header.set(nameBytes, 30);

    const entry = new Uint8Array(header.length + deflated.length);
    entry.set(header, 0);
    entry.set(deflated, header.length);
    local.push(entry);

    const record = new Uint8Array(46 + nameBytes.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, 0x02014b50, true);
    recordView.setUint16(10, 8, true);
    recordView.setUint32(20, deflated.length, true);
    recordView.setUint32(24, raw.length, true);
    recordView.setUint16(28, nameBytes.length, true);
    recordView.setUint32(42, offset, true);
    record.set(nameBytes, 46);
    central.push(record);

    offset += entry.length;
  }

  const centralSize = central.reduce((total, record) => total + record.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, central.length, true);
  endView.setUint16(10, central.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const parts = [...local, ...central, end];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return toBuffer(out);
}

describe("readSpreadsheet, xlsx", () => {
  it("resolves shared strings, inline strings and numbers, and honours cell references", async () => {
    const buffer = await buildZip({
      "xl/sharedStrings.xml":
        "<sst><si><t>email</t></si><si><t>prijmeni</t></si><si><t>BENEŠ</t></si></sst>",
      "xl/worksheets/sheet1.xml":
        "<worksheet><sheetData>" +
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>osCislo</t></is></c></row>' +
        // Column B is skipped entirely, and C carries a number -- both ordinary in an export.
        '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>25238</v></c></row>' +
        "</sheetData></worksheet>",
    });

    expect(await readSpreadsheet(buffer)).toEqual([
      ["email", "prijmeni", "osCislo"],
      ["BENEŠ", "", "25238"],
    ]);
  });

  it("joins the runs a rich-text shared string is split into", async () => {
    const buffer = await buildZip({
      "xl/sharedStrings.xml": "<sst><si><r><t>Nová</t></r><r><t>ková</t></r></si></sst>",
      "xl/worksheets/sheet1.xml":
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>',
    });

    expect(await readSpreadsheet(buffer)).toEqual([["Nováková"]]);
  });
});

/* --------------------------------------------------------------------------------- OLE2/BIFF8 */

function record(id: number, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + body.length);
  const view = new DataView(out.buffer);
  view.setUint16(0, id, true);
  view.setUint16(2, body.length, true);
  out.set(body, 4);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function bof(substream: number): Uint8Array {
  const body = new Uint8Array(16);
  const view = new DataView(body.buffer);
  view.setUint16(0, 0x0600, true); // BIFF8
  view.setUint16(2, substream, true);
  return record(0x0809, body);
}

/** One SST string: count, a flag byte saying wide or narrow, then the characters. */
function sstString(value: string, wide: boolean): Uint8Array {
  const out = new Uint8Array(3 + value.length * (wide ? 2 : 1));
  const view = new DataView(out.buffer);
  view.setUint16(0, value.length, true);
  view.setUint8(2, wide ? 1 : 0);
  for (let index = 0; index < value.length; index += 1) {
    if (wide) view.setUint16(3 + index * 2, value.charCodeAt(index), true);
    else view.setUint8(3 + index, value.charCodeAt(index));
  }
  return out;
}

function cell(id: number, row: number, column: number, tail: Uint8Array): Uint8Array {
  const body = new Uint8Array(6 + tail.length);
  const view = new DataView(body.buffer);
  view.setUint16(0, row, true);
  view.setUint16(2, column, true);
  view.setUint16(4, 15, true); // some format index; never read
  body.set(tail, 6);
  return record(id, body);
}

function labelSst(row: number, column: number, index: number): Uint8Array {
  const tail = new Uint8Array(4);
  new DataView(tail.buffer).setUint32(0, index, true);
  return cell(0x00fd, row, column, tail);
}

function number(row: number, column: number, value: number): Uint8Array {
  const tail = new Uint8Array(8);
  new DataView(tail.buffer).setFloat64(0, value, true);
  return cell(0x0203, row, column, tail);
}

/** An integer RK: the value shifted left two with the "is an integer" bit set. */
function rk(row: number, column: number, value: number): Uint8Array {
  const tail = new Uint8Array(4);
  new DataView(tail.buffer).setUint32(0, ((value << 2) | 2) >>> 0, true);
  return cell(0x027e, row, column, tail);
}

function mulRk(row: number, first: number, values: number[]): Uint8Array {
  const body = new Uint8Array(4 + values.length * 6 + 2);
  const view = new DataView(body.buffer);
  view.setUint16(0, row, true);
  view.setUint16(2, first, true);
  values.forEach((value, index) => {
    view.setUint16(4 + index * 6, 15, true);
    view.setUint32(4 + index * 6 + 2, ((value << 2) | 2) >>> 0, true);
  });
  view.setUint16(4 + values.length * 6, first + values.length - 1, true);
  return body.length > 0 ? record(0x00bd, body) : body;
}

/** Wraps a workbook stream in a minimal compound file. The stream is padded past the 4 096-byte
 *  mini-stream cutoff so it travels through the ordinary sector chain. */
function buildXls(workbook: Uint8Array): ArrayBuffer {
  const sector = 512;
  const padded =
    workbook.length >= 4096
      ? workbook
      : concat([workbook, record(0x005c, new Uint8Array(4096 - workbook.length))]);

  const dataSectors = Math.ceil(padded.length / sector);
  const total = 1 + 1 + 1 + dataSectors; // header, FAT, directory, stream
  const out = new Uint8Array(total * sector);
  const view = new DataView(out.buffer);

  out.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  view.setUint16(0x1e, 9, true); // 512-byte sectors
  view.setUint16(0x20, 6, true); // 64-byte mini sectors
  view.setUint32(0x2c, 1, true); // one FAT sector
  view.setUint32(0x30, 1, true); // directory starts at sector 1
  view.setUint32(0x38, 4096, true); // mini-stream cutoff
  view.setUint32(0x3c, 0xfffffffe, true); // no mini FAT
  view.setUint32(0x44, 0xfffffffe, true); // no extra DIFAT
  view.setUint32(0x4c, 0, true); // the FAT lives in sector 0
  for (let index = 1; index < 109; index += 1) view.setUint32(0x4c + index * 4, 0xffffffff, true);

  const fatBase = sector;
  for (let index = 0; index < sector / 4; index += 1) {
    view.setUint32(fatBase + index * 4, 0xffffffff, true);
  }
  view.setUint32(fatBase + 0 * 4, 0xfffffffd, true); // the FAT sector itself
  view.setUint32(fatBase + 1 * 4, 0xfffffffe, true); // the directory, one sector
  for (let index = 0; index < dataSectors; index += 1) {
    const here = 2 + index;
    view.setUint32(fatBase + here * 4, index === dataSectors - 1 ? 0xfffffffe : here + 1, true);
  }

  const dirBase = 2 * sector;
  const writeEntry = (slot: number, name: string, type: number, start: number, size: number) => {
    const base = dirBase + slot * 128;
    for (let index = 0; index < name.length; index += 1) {
      view.setUint16(base + index * 2, name.charCodeAt(index), true);
    }
    view.setUint16(base + 64, name.length * 2 + 2, true);
    view.setUint8(base + 66, type);
    view.setUint32(base + 116, start, true);
    view.setUint32(base + 120, size, true);
  };
  writeEntry(0, "Root Entry", 5, 0xfffffffe, 0);
  writeEntry(1, "Workbook", 2, 2, padded.length); // the stream starts at sector 2

  out.set(padded, 3 * sector);
  return toBuffer(out);
}

describe("readSpreadsheet, legacy binary .xls", () => {
  it("reads labels, numbers and runs of numbers off the first sheet", async () => {
    const sst = concat([
      (() => {
        const head = new Uint8Array(8);
        const view = new DataView(head.buffer);
        view.setUint32(0, 4, true); // total references
        view.setUint32(4, 4, true); // unique strings
        return head;
      })(),
      sstString("osCislo", false),
      sstString("prijmeni", false),
      sstString("BENEŠ", true), // needs the wide form, and exercises it
      sstString("jiný list", true),
    ]);

    const workbook = concat([
      bof(0x0005),
      record(0x00fc, sst),
      record(0x000a, new Uint8Array(0)),
      bof(0x0010),
      labelSst(0, 0, 0),
      labelSst(0, 1, 1),
      labelSst(1, 1, 2),
      rk(1, 0, 25238),
      number(1, 2, 2.5),
      mulRk(2, 0, [1, 2, 3]),
      record(0x000a, new Uint8Array(0)),
      // A second worksheet, whose cells must not leak into the first one's grid.
      bof(0x0010),
      labelSst(0, 0, 3),
      record(0x000a, new Uint8Array(0)),
    ]);

    expect(await readSpreadsheet(buildXls(workbook))).toEqual([
      ["osCislo", "prijmeni", ""],
      ["25238", "BENEŠ", "2.5"],
      ["1", "2", "3"],
    ]);
  });

  it("reads a shared string table that continues into CONTINUE records, split mid-string", async () => {
    // Three strings; the last one is cut in half, and its tail arrives in a CONTINUE record that
    // restates the wide flag. This is the case a naive reader gets wrong, and the one every file
    // with more than a few hundred people in it contains.
    const head = new Uint8Array(8);
    const headView = new DataView(head.buffer);
    headView.setUint32(0, 3, true);
    headView.setUint32(4, 3, true);

    const whole = sstString("Nováková", true);
    const cutAfter = 3 + 4 * 2; // the count, the flag byte, and four of the eight characters
    const firstHalf = whole.subarray(0, cutAfter);
    const secondHalf = concat([new Uint8Array([1]), whole.subarray(cutAfter)]);

    const workbook = concat([
      bof(0x0005),
      record(
        0x00fc,
        concat([head, sstString("email", false), sstString("prijmeni", false), firstHalf]),
      ),
      record(0x003c, secondHalf),
      record(0x000a, new Uint8Array(0)),
      bof(0x0010),
      labelSst(0, 0, 0),
      labelSst(0, 1, 1),
      labelSst(1, 1, 2),
      record(0x000a, new Uint8Array(0)),
    ]);

    expect(await readSpreadsheet(buildXls(workbook))).toEqual([
      ["email", "prijmeni"],
      ["", "Nováková"],
    ]);
  });
});
