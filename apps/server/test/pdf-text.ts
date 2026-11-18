import { inflateSync } from 'node:zlib';

const HEX = '[0-9a-fA-F]+';
const BF_CHAR = new RegExp(`^<${HEX}>\\s*<(${HEX})>$`);
const BF_RANGE = new RegExp(`^<(${HEX})>\\s*<(${HEX})>\\s*<(${HEX})>$`);

/** UTF-16BE text of one table entry; a glyph can stand for several characters (a Gujarati conjunct). */
function utf16(hex: string): number[] {
  const units: number[] = [];
  for (let at = 0; at + 4 <= hex.length; at += 4) units.push(parseInt(hex.slice(at, at + 4), 16));
  return units;
}

function addTable(found: Set<number>, table: string): void {
  for (const line of table.split(/\r?\n/).map((l) => l.trim())) {
    const range = BF_RANGE.exec(line);
    if (range) {
      const [low, high] = [parseInt(range[1] as string, 16), parseInt(range[2] as string, 16)];
      const first = parseInt(range[3] as string, 16);
      for (let step = 0; step <= high - low; step += 1) found.add(first + step);
      continue;
    }
    const single = BF_CHAR.exec(line);
    if (single) utf16(single[1] as string).forEach((unit) => found.add(unit));
  }
}

/**
 * The characters a PDF shows, read back from its font tables (ToUnicode maps) and the text Chromium attaches
 * to joined letters (ActualText), with no extra tool.
 * Chromium writes one table per embedded font; a character with no font on the machine is drawn as a
 * blank box and never reaches a table, so a missing Gujarati font fails the test that uses this.
 */
export function pdfCharacters(pdf: Buffer): Set<number> {
  const found = new Set<number>();
  for (const match of pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let text: string;
    try {
      text = inflateSync(Buffer.from(match[1] as string, 'latin1')).toString('latin1');
    } catch {
      continue; // an image or a font program, not a table
    }
    if (text.includes('beginbfchar') || text.includes('beginbfrange')) addTable(found, text);
    for (const span of text.matchAll(/\/ActualText\s*<FEFF([0-9a-fA-F]*)>/g)) {
      utf16(span[1] as string).forEach((unit) => found.add(unit));
    }
  }
  return found;
}

/** Every distinct non-ASCII character of `text` is drawn somewhere in the PDF. */
export function pdfShows(pdf: Buffer, text: string): boolean {
  const drawn = pdfCharacters(pdf);
  return [...text]
    .filter((char) => char.charCodeAt(0) > 127)
    .every((char) => drawn.has(char.charCodeAt(0)));
}

/** UTF-16BE of a destination string in a ToUnicode range. */
function decodeUtf16(hex: string): string {
  const units: number[] = [];
  for (let at = 0; at + 4 <= hex.length; at += 4) units.push(parseInt(hex.slice(at, at + 4), 16));
  return String.fromCharCode(...units);
}

/** One font's ToUnicode table: the code a content stream draws to the text it stands for. */
function textMap(table: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const block of table.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of (block[1] as string).matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      map.set(parseInt(pair[1] as string, 16), decodeUtf16(pair[2] as string));
    }
  }
  for (const block of table.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const range of (block[1] as string).matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g,
    )) {
      const low = parseInt(range[1] as string, 16);
      const high = parseInt(range[2] as string, 16);
      const first = parseInt(range[3] as string, 16);
      for (let code = low; code <= high; code += 1) {
        map.set(code, String.fromCharCode(first + code - low));
      }
    }
  }
  return map;
}

/** Every object of the PDF, by its number: Chromium writes an uncompressed dictionary per object. */
function pdfObjects(pdf: Buffer): Map<number, string> {
  const objects = new Map<number, string>();
  for (const match of pdf.toString('latin1').matchAll(/(\d+) 0 obj\s*([\s\S]*?)\s*endobj/g)) {
    objects.set(Number(match[1]), match[2] as string);
  }
  return objects;
}

function streamText(body: string | undefined): string | null {
  const stream = /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(body ?? '');
  if (!stream) return null;
  try {
    return inflateSync(Buffer.from(stream[1] as string, 'latin1')).toString('latin1');
  } catch {
    return null;
  }
}

/** The ToUnicode map of each font resource the page names (F4 to its map). */
function pageFonts(page: string, objects: Map<number, string>): Map<string, Map<number, string>> {
  const direct = /\/Font\s*<<([\s\S]*?)>>/.exec(page);
  let block = direct?.[1];
  if (block === undefined) {
    const ref = /\/Font\s+(\d+) 0 R/.exec(page);
    const fontDict = ref ? objects.get(Number(ref[1])) : undefined;
    block = fontDict ? /<<([\s\S]*)>>/.exec(fontDict)?.[1] : undefined;
  }
  const fonts = new Map<string, Map<number, string>>();
  for (const font of (block ?? '').matchAll(/\/([A-Za-z0-9]+)\s+(\d+) 0 R/g)) {
    const body = objects.get(Number(font[2]));
    const toUnicode = /\/ToUnicode\s+(\d+) 0 R/.exec(body ?? '');
    if (!toUnicode) continue;
    const table = streamText(objects.get(Number(toUnicode[1])));
    if (table) fonts.set(font[1] as string, textMap(table));
  }
  return fonts;
}

/** Identity-H draws two-byte codes; Chromium's simple Type3 fallback draws one-byte codes. */
function decodeHex(hex: string, font: Map<number, string>): string {
  const width = hex.length % 4 === 0 ? 4 : 2;
  const codes = hex.match(new RegExp(`.{${width}}`, 'g')) ?? [];
  return codes.map((code) => font.get(parseInt(code, 16)) ?? '').join('');
}

/** The decoded text of one content stream: each drawn code through the font selected at that point. */
function contentText(content: string, fonts: Map<string, Map<number, string>>): string {
  let font: Map<number, string> | undefined;
  let inText = false;
  let found = '';
  const tokens = content.match(/\/[A-Za-z0-9]+\s+[\d.]+\s+Tf|<[0-9a-fA-F]+>|\bBT\b|\bET\b/g) ?? [];
  for (const token of tokens) {
    if (token === 'BT') inText = true;
    else if (token === 'ET') inText = false;
    else {
      const selected = /^\/([A-Za-z0-9]+)/.exec(token);
      const hex = /^<([0-9a-fA-F]+)>$/.exec(token);
      if (selected) font = fonts.get(selected[1] as string);
      else if (inText && font && hex) found += decodeHex(hex[1] as string, font);
    }
  }
  return found;
}

/**
 * The text a Chromium PDF draws, in the order it draws it: each page's ToUnicode table decodes the codes of its
 * content streams. A run split across text operators joins without a space, so a caller compares with whitespace
 * removed. Enough for a server-rendered report (one embedded font per style); not a general PDF reader.
 */
export function pdfText(pdf: Buffer): string {
  const objects = pdfObjects(pdf);
  const pages = [...objects.values()].filter((body) => /\/Type\s*\/Page\b/.test(body));
  return pages
    .map((page) => {
      const fonts = pageFonts(page, objects);
      const contents = /\/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)/.exec(page)?.[1] ?? '';
      const refs = [...contents.matchAll(/(\d+) 0 R/g)].map((match) => Number(match[1]));
      return refs
        .map((ref) => streamText(objects.get(ref)) ?? '')
        .map((stream) => contentText(stream, fonts))
        .join('');
    })
    .join('\n');
}
