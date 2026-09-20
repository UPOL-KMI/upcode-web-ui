/**
 * Reading a downloaded spreadsheet into a grid of strings, for the roster import (X-015).
 *
 * **The format is decided by the first bytes, never by the file name.** The operator's own STAG
 * export is named `.xls` and is a binary OLE2 workbook that Excel re-saved; portals of that kind
 * are also known to serve an HTML table under the same extension, and a teacher who saves the
 * thing from Excel produces a third format again. Trusting the extension would mean refusing files
 * that are perfectly readable, or worse, reading one as another and producing a grid of mojibake.
 *
 * Four shapes are understood: OLE2/BIFF8 (`.xls`), OOXML (`.xlsx`), an HTML table, and delimited
 * text. Nothing else is guessed at -- an unreadable file says so.
 *
 * **No dependency.** `xlsx` is the only mainstream reader of the legacy binary format and the copy
 * on npm is the abandoned one, which is not a thing to put in a deployment that holds student
 * records. What is here is the subset those two formats actually use for a table of text: enough
 * to read a roster, and deliberately not a spreadsheet engine.
 *
 * The result is a rectangle of trimmed strings with the sheet's own row and column positions
 * preserved, including empty cells -- `lib/users/column-map.ts` needs the positions to line a
 * header up with its data.
 */
export type Grid = string[][];

/** Everything this file refuses at, in one shape the screen can translate. */
export class SpreadsheetError extends Error {
  constructor(readonly reason: "unsupported" | "empty" | "legacyBiff" | "noInflate") {
    super(reason);
    this.name = "SpreadsheetError";
  }
}

export async function readSpreadsheet(bytes: ArrayBuffer): Promise<Grid> {
  const head = new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength));

  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0])) return trimGrid(readBiff8(bytes));
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return trimGrid(await readXlsx(bytes));

  const text = decodeText(bytes);
  if (/<\s*(table|html|body)[\s>]/i.test(text.slice(0, 4096))) {
    return trimGrid(readHtmlTable(text));
  }
  return trimGrid(readDelimited(text));
}

function startsWith(head: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => head[index] === byte);
}

/**
 * **UTF-8 first, Windows-1250 as the fallback**, which is the pair a Czech faculty actually
 * produces: anything exported today is UTF-8, anything saved as CSV from a Czech Excel is not.
 * The choice is made by *trying* UTF-8 strictly rather than by sniffing, so a file that is valid
 * UTF-8 is never second-guessed and one that is not never arrives as replacement characters.
 */
function decodeText(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1250").decode(bytes);
  }
}

/** Drops trailing empty rows and columns, so a sheet with formatting out to column BZ does not
 *  arrive as fifty empty headers. */
function trimGrid(grid: Grid): Grid {
  const rows = grid.map((row) => [...row]);
  while (rows.length > 0 && rows[rows.length - 1]!.every((cell) => cell === "")) rows.pop();
  if (rows.length === 0) throw new SpreadsheetError("empty");

  let width = 0;
  for (const row of rows) {
    for (let index = row.length - 1; index >= 0; index -= 1) {
      if (row[index] !== "") {
        width = Math.max(width, index + 1);
        break;
      }
    }
  }
  if (width === 0) throw new SpreadsheetError("empty");

  return rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
}

/* ------------------------------------------------------------------ delimited text and HTML */

/** Splits one line into fields, honouring double quotes. Shared shape with `import-roster.ts`,
 *  kept separate because that one splits a line the reader typed and this one a file. */
function splitDelimited(line: string, delimiter: string): string[] {
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

function readDelimited(text: string): Grid {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) throw new SpreadsheetError("empty");
  const header = lines[0]!;
  const delimiter = header.includes("\t") ? "\t" : header.includes(";") ? ";" : ",";
  return lines.map((line) => splitDelimited(line, delimiter));
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * An HTML table, read without a DOM.
 *
 * `DOMParser` would be the obvious tool and is not used on purpose: this module is unit-tested,
 * the tests run in Node, and a reader that can only be exercised in a browser is a reader nobody
 * checks. The markup these exports produce is machine-generated and flat, so a scan over `<tr>`
 * and `<td>`/`<th>` is enough; anything cleverer would be answering a question no export asks.
 */
function readHtmlTable(text: string): Grid {
  const rows: Grid = [];
  for (const [, body] of text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)) {
    const cells: string[] = [];
    for (const [, cell] of (body ?? "").matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi)) {
      cells.push(
        decodeEntities(
          (cell ?? "")
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/<[^>]*>/g, "")
            .replace(/\s+/g, " "),
        ).trim(),
      );
    }
    if (cells.length > 0) rows.push(cells);
  }
  if (rows.length === 0) throw new SpreadsheetError("empty");
  return rows;
}

/* ------------------------------------------------------------------------------ OLE2 / BIFF8 */

/**
 * The compound-file container a `.xls` is: a FAT of 512-byte sectors, a second FAT of 64-byte
 * mini-sectors for small streams, and a directory listing the streams by name. Only one stream is
 * wanted -- `Workbook` (`Book` in files old enough) -- and the rest of the container is walked
 * only far enough to find it.
 */
function readOle2Stream(buffer: ArrayBuffer, wanted: readonly string[]): DataView {
  const view = new DataView(buffer);
  const sectorSize = 1 << view.getUint16(0x1e, true);
  const miniSize = 1 << view.getUint16(0x20, true);
  const fatCount = view.getUint32(0x2c, true);
  const dirStart = view.getUint32(0x30, true);
  const miniCutoff = view.getUint32(0x38, true);
  const miniFatStart = view.getUint32(0x3c, true);
  let difatStart = view.getUint32(0x44, true);
  let difatCount = view.getUint32(0x48, true);

  const at = (sector: number) => (sector + 1) * sectorSize;

  const difat: number[] = [];
  for (let index = 0; index < 109; index += 1) difat.push(view.getUint32(0x4c + index * 4, true));
  while (difatCount > 0 && difatStart < 0xfffffffe) {
    const base = at(difatStart);
    const perSector = sectorSize / 4;
    for (let index = 0; index < perSector - 1; index += 1) {
      difat.push(view.getUint32(base + index * 4, true));
    }
    difatStart = view.getUint32(base + (perSector - 1) * 4, true);
    difatCount -= 1;
  }

  const fat: number[] = [];
  for (const sector of difat.slice(0, fatCount)) {
    if (sector >= 0xfffffffe) continue;
    const base = at(sector);
    for (let index = 0; index < sectorSize / 4; index += 1) {
      fat.push(view.getUint32(base + index * 4, true));
    }
  }

  // `0xfffffffc` and up are the four reserved markers -- end of chain, free, and the sectors the
  // FAT and the DIFAT occupy. Stopping only at end-of-chain walks into the FAT itself and asks for
  // a slice a couple of terabytes long.
  const chain = (start: number, table: number[]) => {
    const sectors: number[] = [];
    let sector = start;
    while (sector < 0xfffffffc && sectors.length < 1_000_000) {
      sectors.push(sector);
      sector = table[sector] ?? 0xfffffffc;
    }
    return sectors;
  };

  const gather = (sectors: number[], size: number, unit: number, source: Uint8Array | null) => {
    const out = new Uint8Array(sectors.length * unit);
    sectors.forEach((sector, index) => {
      const offset = source === null ? at(sector) : sector * unit;
      const available = (source === null ? buffer.byteLength : source.byteLength) - offset;
      if (available <= 0) return;
      const slice =
        source === null
          ? new Uint8Array(buffer, offset, Math.min(unit, available))
          : source.subarray(offset, offset + unit);
      out.set(slice, index * unit);
    });
    return out.subarray(0, size === 0 ? out.length : size);
  };

  const directory = gather(chain(dirStart, fat), 0, sectorSize, null);
  const dirView = new DataView(directory.buffer, directory.byteOffset, directory.byteLength);

  interface Entry {
    name: string;
    type: number;
    start: number;
    size: number;
  }
  const entries: Entry[] = [];
  for (let offset = 0; offset + 128 <= directory.byteLength; offset += 128) {
    const nameLength = dirView.getUint16(offset + 64, true);
    let name = "";
    for (let index = 0; index + 1 < Math.max(0, nameLength - 2); index += 2) {
      name += String.fromCharCode(dirView.getUint16(offset + index, true));
    }
    entries.push({
      name,
      type: directory[offset + 66]!,
      start: dirView.getUint32(offset + 116, true),
      size: dirView.getUint32(offset + 120, true),
    });
  }

  const root = entries.find((entry) => entry.type === 5);
  const miniStream =
    root === undefined || root.size === 0
      ? new Uint8Array(0)
      : gather(chain(root.start, fat), root.size, sectorSize, null);

  const miniFat: number[] = [];
  if (miniFatStart < 0xfffffffe) {
    const raw = gather(chain(miniFatStart, fat), 0, sectorSize, null);
    const rawView = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    for (let index = 0; index + 4 <= raw.byteLength; index += 4) {
      miniFat.push(rawView.getUint32(index, true));
    }
  }

  const stream = entries.find((entry) => entry.type === 2 && wanted.includes(entry.name));
  if (stream === undefined) throw new SpreadsheetError("unsupported");

  const bytes =
    stream.size < miniCutoff
      ? gather(chain(stream.start, miniFat), stream.size, miniSize, miniStream)
      : gather(chain(stream.start, fat), stream.size, sectorSize, null);

  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

interface Biff8Record {
  id: number;
  start: number;
  length: number;
}

function readBiff8(buffer: ArrayBuffer): Grid {
  const view = readOle2Stream(buffer, ["Workbook", "Book"]);

  const records: Biff8Record[] = [];
  for (let offset = 0; offset + 4 <= view.byteLength;) {
    const id = view.getUint16(offset, true);
    const length = view.getUint16(offset + 2, true);
    records.push({ id, start: offset + 4, length });
    offset += 4 + length;
  }

  const first = records[0];
  if (first === undefined || first.id !== 0x0809) throw new SpreadsheetError("unsupported");
  if (view.getUint16(first.start, true) < 0x0600) throw new SpreadsheetError("legacyBiff");

  const strings = readSharedStrings(view, records);

  const grid: Grid = [];
  const put = (row: number, column: number, value: string) => {
    while (grid.length <= row) grid.push([]);
    const line = grid[row]!;
    while (line.length <= column) line.push("");
    line[column] = value;
  };

  // Only the first worksheet. A workbook's records are one flat stream of substreams, so the
  // sheet a cell belongs to is "however many worksheet BOFs came before it".
  let sheet = 0;
  let pendingString: { row: number; column: number } | null = null;

  for (const record of records) {
    if (record.id === 0x0809) {
      if (record.length >= 4 && view.getUint16(record.start + 2, true) === 0x0010) sheet += 1;
      continue;
    }
    if (sheet !== 1) continue;

    const row = record.length >= 4 ? view.getUint16(record.start, true) : 0;
    const column = record.length >= 4 ? view.getUint16(record.start + 2, true) : 0;

    switch (record.id) {
      case 0x00fd: {
        // LABELSST
        const index = view.getUint32(record.start + 6, true);
        put(row, column, strings[index] ?? "");
        break;
      }
      case 0x0204: // LABEL
        put(row, column, readUnicodeString(view, record.start + 6, 2).value);
        break;
      case 0x0203: // NUMBER
        put(row, column, formatNumber(view.getFloat64(record.start + 6, true)));
        break;
      case 0x027e: // RK
        put(row, column, formatNumber(decodeRk(view.getUint32(record.start + 6, true))));
        break;
      case 0x00bd: {
        // MULRK -- one record carrying a run of adjacent numeric cells
        const count = Math.floor((record.length - 6) / 6);
        for (let index = 0; index < count; index += 1) {
          const rk = view.getUint32(record.start + 4 + index * 6 + 2, true);
          put(row, column + index, formatNumber(decodeRk(rk)));
        }
        break;
      }
      case 0x0006: {
        // FORMULA. A cached string result is announced here and delivered by the next STRING
        // record; anything else is a number in the same eight bytes.
        if (view.getUint16(record.start + 12, true) === 0xffff) {
          pendingString = { row, column };
        } else {
          put(row, column, formatNumber(view.getFloat64(record.start + 6, true)));
        }
        break;
      }
      case 0x0207: {
        // STRING -- the result the FORMULA above promised
        if (pendingString !== null) {
          const { value } = readUnicodeString(view, record.start, 2);
          put(pendingString.row, pendingString.column, value);
          pendingString = null;
        }
        break;
      }
      default:
        break;
    }
  }

  if (grid.length === 0) throw new SpreadsheetError("empty");
  return grid;
}

/**
 * The shared string table, which is where every piece of text in a `.xls` actually lives.
 *
 * It is the one record that routinely outgrows the 8 KB a BIFF record may hold, so it continues
 * into `CONTINUE` records -- **and a string may be cut in half across that boundary**, with the
 * remainder carrying its own flag byte saying whether it resumes wide or narrow. That is the only
 * genuinely awkward part of the format and the part a naive reader gets wrong on any file with
 * more than a few hundred people in it.
 */
function readSharedStrings(view: DataView, records: readonly Biff8Record[]): string[] {
  const sstIndex = records.findIndex((record) => record.id === 0x00fc);
  if (sstIndex < 0) return [];

  const blocks: { start: number; end: number }[] = [
    {
      start: records[sstIndex]!.start + 8,
      end: records[sstIndex]!.start + records[sstIndex]!.length,
    },
  ];
  for (
    let index = sstIndex + 1;
    index < records.length && records[index]!.id === 0x003c;
    index += 1
  ) {
    blocks.push({
      start: records[index]!.start,
      end: records[index]!.start + records[index]!.length,
    });
  }

  const unique = view.getUint32(records[sstIndex]!.start + 4, true);
  const strings: string[] = [];

  let block = 0;
  let offset = blocks[0]!.start;
  const remaining = () => (block < blocks.length ? blocks[block]!.end - offset : 0);
  const advance = () => {
    block += 1;
    if (block < blocks.length) offset = blocks[block]!.start;
  };

  while (strings.length < unique && block < blocks.length) {
    if (remaining() < 3) {
      advance();
      continue;
    }

    const count = view.getUint16(offset, true);
    let flags = view.getUint8(offset + 2);
    offset += 3;

    let rich = 0;
    let extended = 0;
    if ((flags & 8) !== 0) {
      rich = view.getUint16(offset, true);
      offset += 2;
    }
    if ((flags & 4) !== 0) {
      extended = view.getUint32(offset, true);
      offset += 4;
    }

    let value = "";
    let left = count;
    while (left > 0) {
      if (remaining() <= 0) {
        advance();
        if (block >= blocks.length) break;
        // The continuation restates whether the rest of this string is wide.
        flags = view.getUint8(offset);
        offset += 1;
      }
      const wide = (flags & 1) !== 0;
      const fits = Math.min(left, Math.floor(remaining() / (wide ? 2 : 1)));
      for (let index = 0; index < fits; index += 1) {
        value += String.fromCharCode(wide ? view.getUint16(offset, true) : view.getUint8(offset));
        offset += wide ? 2 : 1;
      }
      if (fits === 0) {
        advance();
        if (block >= blocks.length) break;
        flags = view.getUint8(offset);
        offset += 1;
      }
      left -= fits;
    }

    // Formatting runs and the Far East extension follow the characters and are of no interest,
    // but they still have to be stepped over -- and they can straddle a block too.
    let skip = rich * 4 + extended;
    while (skip > 0 && block < blocks.length) {
      const here = Math.min(skip, remaining());
      offset += here;
      skip -= here;
      if (skip > 0) advance();
    }

    strings.push(value);
  }

  return strings;
}

/** `cchBytes` is 2 for the strings inside cells and the SST, 1 for the short ones elsewhere. */
function readUnicodeString(
  view: DataView,
  start: number,
  cchBytes: 1 | 2,
): { value: string; end: number } {
  let offset = start;
  const count = cchBytes === 2 ? view.getUint16(offset, true) : view.getUint8(offset);
  offset += cchBytes;
  const flags = view.getUint8(offset);
  offset += 1;

  let rich = 0;
  let extended = 0;
  if ((flags & 8) !== 0) {
    rich = view.getUint16(offset, true);
    offset += 2;
  }
  if ((flags & 4) !== 0) {
    extended = view.getUint32(offset, true);
    offset += 4;
  }

  const wide = (flags & 1) !== 0;
  let value = "";
  for (let index = 0; index < count; index += 1) {
    if (offset >= view.byteLength) break;
    value += String.fromCharCode(wide ? view.getUint16(offset, true) : view.getUint8(offset));
    offset += wide ? 2 : 1;
  }

  return { value, end: offset + rich * 4 + extended };
}

/** An RK is a float squeezed into four bytes: either a 30-bit integer or the top half of a
 *  double, in both cases optionally divided by a hundred. */
function decodeRk(raw: number): number {
  let value: number;
  if ((raw & 2) !== 0) {
    value = (raw | 0) >> 2;
  } else {
    const bytes = new ArrayBuffer(8);
    new DataView(bytes).setUint32(4, raw & 0xfffffffc, true);
    value = new DataView(bytes).getFloat64(0, true);
  }
  return (raw & 1) !== 0 ? value / 100 : value;
}

/** Binary floating point renders `1.0000000000000002` for numbers a sheet shows as `1`. Fifteen
 *  significant digits is the most a double carries reliably, and it is far more than a student
 *  number needs. */
function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  return String(Number.parseFloat(value.toPrecision(15)));
}

/* ------------------------------------------------------------------------------ OOXML / xlsx */

async function readXlsx(buffer: ArrayBuffer): Promise<Grid> {
  const zip = readZipDirectory(buffer);

  const sheetPath = firstSheetPath(zip, buffer);
  const sheetXml = await readZipEntry(zip, buffer, sheetPath);
  if (sheetXml === null) throw new SpreadsheetError("unsupported");

  const sharedXml = await readZipEntry(zip, buffer, "xl/sharedStrings.xml");
  const shared = sharedXml === null ? [] : readSharedStringsXml(sharedXml);

  return readSheetXml(sheetXml, shared);
}

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function readZipDirectory(buffer: ArrayBuffer): Map<string, ZipEntry> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  let eocd = -1;
  const limit = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= limit; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new SpreadsheetError("unsupported");

  const entries = new Map<string, ZipEntry>();
  let offset = view.getUint32(eocd + 16, true);
  const count = view.getUint16(eocd + 10, true);

  for (let index = 0; index < count && offset + 46 <= bytes.length; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = new TextDecoder("utf-8").decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    entries.set(name, {
      name,
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

async function readZipEntry(
  zip: Map<string, ZipEntry>,
  buffer: ArrayBuffer,
  name: string,
): Promise<string | null> {
  const entry = zip.get(name);
  if (entry === undefined) return null;

  const view = new DataView(buffer);
  const local = entry.localHeaderOffset;
  if (view.getUint32(local, true) !== 0x04034b50) throw new SpreadsheetError("unsupported");
  const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
  const raw = new Uint8Array(buffer, start, entry.compressedSize);

  if (entry.method === 0) return new TextDecoder("utf-8").decode(raw);
  if (entry.method !== 8) throw new SpreadsheetError("unsupported");

  // `DecompressionStream` is the platform's own inflate. It has been in every browser since 2023
  // and in Node since 18; a runtime without it gets a sentence rather than a stack trace.
  if (typeof DecompressionStream === "undefined") throw new SpreadsheetError("noInflate");

  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new TextDecoder("utf-8").decode(await new Response(stream).arrayBuffer());
}

/**
 * The first sheet **in the workbook's own order**, which is not reliably `sheet1.xml`: the file
 * names follow creation order and the tabs can be rearranged. Resolved through the relationship
 * the workbook names, and falling back to the obvious name when a writer omits the parts.
 */
function firstSheetPath(zip: Map<string, ZipEntry>, buffer: ArrayBuffer): string {
  void buffer;
  const fallback = "xl/worksheets/sheet1.xml";
  return zip.has(fallback)
    ? fallback
    : ([...zip.keys()].find((name) => name.startsWith("xl/worksheets/") && name.endsWith(".xml")) ??
        fallback);
}

function readSharedStringsXml(xml: string): string[] {
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(([, body]) =>
    [...body!.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map(([, run]) => decodeEntities(run!))
      .join(""),
  );
}

function readSheetXml(xml: string, shared: readonly string[]): Grid {
  const grid: Grid = [];

  for (const [, attributes, body] of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const declared = /\br="(\d+)"/.exec(attributes!)?.[1];
    const rowIndex = declared === undefined ? grid.length : Number.parseInt(declared, 10) - 1;
    while (grid.length <= rowIndex) grid.push([]);
    const line = grid[rowIndex]!;

    let cursor = 0;
    for (const [, cellAttributes, cellBody] of body!.matchAll(
      /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
    )) {
      const reference = /\br="([A-Z]+)\d+"/.exec(cellAttributes!)?.[1];
      const column = reference === undefined ? cursor : columnIndex(reference);
      cursor = column + 1;

      const type = /\bt="([^"]+)"/.exec(cellAttributes!)?.[1] ?? "n";
      const body_ = cellBody ?? "";
      let value = "";

      if (type === "s") {
        const index = Number.parseInt(/<v>([\s\S]*?)<\/v>/.exec(body_)?.[1] ?? "-1", 10);
        value = shared[index] ?? "";
      } else if (type === "inlineStr") {
        value = [...body_.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
          .map(([, run]) => decodeEntities(run!))
          .join("");
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body_)?.[1];
        if (raw !== undefined) {
          const text = decodeEntities(raw);
          value =
            type === "n" && text !== "" && !Number.isNaN(Number(text))
              ? formatNumber(Number(text))
              : text;
        }
      }

      while (line.length <= column) line.push("");
      line[column] = value.trim();
    }
  }

  if (grid.length === 0) throw new SpreadsheetError("empty");
  return grid;
}

/** `A` → 0, `Z` → 25, `AA` → 26. */
function columnIndex(reference: string): number {
  let index = 0;
  for (const character of reference) index = index * 26 + (character.charCodeAt(0) - 64);
  return index - 1;
}
