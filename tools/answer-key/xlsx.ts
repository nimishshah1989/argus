import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

/**
 * A read-only .xlsx reader just big enough for Bhavin's export: a zip, inline or shared strings, numbers.
 * Rows come back as arrays with `null` for an empty cell, empty rows kept, like the platform's own reader.
 */

export type Cell = string | number | null;
export type Sheets = Record<string, Cell[][]>;

function zipEntries(zip: Buffer): Map<string, string> {
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('answer-key: not a zip file');
  const count = zip.readUInt16LE(end + 10);
  const files = new Map<string, string>();
  let at = zip.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const rest = zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength);
    const from = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const body = zip.subarray(from, from + size);
    files.set(name, (method === 8 ? inflateRawSync(body) : body).toString('utf8'));
    at += 46 + nameLength + rest;
  }
  return files;
}

const unescapeXml = (text: string): string =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const textOf = (xml: string): string =>
  unescapeXml([...xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).join(''));

function columnIndex(letters: string): number {
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

function cellValue(attrs: string, body: string, shared: string[]): Cell {
  const type = /\bt="([^"]*)"/.exec(attrs)?.[1] ?? 'n';
  if (type === 'inlineStr') return textOf(body);
  const raw = /<v>([^<]*)<\/v>/.exec(body)?.[1];
  if (raw === undefined) return null;
  if (type === 's') return shared[Number(raw)] ?? null;
  if (type === 'str') return unescapeXml(raw);
  return Number(raw);
}

function parseSheet(xml: string, shared: string[]): Cell[][] {
  const rows: Cell[][] = [];
  for (const row of xml.matchAll(/<row [^>]*?r="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const at = Number(row[1]) - 1;
    while (rows.length < at) rows.push([]);
    const cells: Cell[] = [];
    for (const c of (row[2] ?? '').matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+)\d+"/.exec(c[1] ?? '')?.[1] ?? 'A';
      while (cells.length < columnIndex(ref)) cells.push(null);
      cells[columnIndex(ref)] = cellValue(c[1] ?? '', c[2] ?? '', shared);
    }
    rows.push(cells);
  }
  return rows;
}

export function readWorkbook(path: string): Sheets {
  const files = zipEntries(readFileSync(path));
  const shared = [
    ...(files.get('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g),
  ].map((m) => textOf(m[1] ?? ''));
  const rels = new Map(
    [...(files.get('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<Relationship [^>]*>/g)].map(
      (m) => [/\bId="([^"]*)"/.exec(m[0])?.[1] ?? '', /\bTarget="([^"]*)"/.exec(m[0])?.[1] ?? ''],
    ),
  );
  const sheets: Sheets = {};
  for (const m of (files.get('xl/workbook.xml') ?? '').matchAll(/<sheet [^>]*>/g)) {
    const name = unescapeXml(/\bname="([^"]*)"/.exec(m[0])?.[1] ?? '');
    const target = rels.get(/\br:id="([^"]*)"/.exec(m[0])?.[1] ?? '') ?? '';
    const xml = files.get(`xl/${target.replace(/^\/?(xl\/)?/, '')}`);
    if (xml === undefined) throw new Error(`answer-key: sheet ${name} has no data`);
    sheets[name] = parseSheet(xml, shared);
  }
  return sheets;
}
