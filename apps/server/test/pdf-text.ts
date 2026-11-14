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
