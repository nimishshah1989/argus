import { readFileSync } from 'node:fs';
import type { TFunction } from 'i18next';
import { en } from '@uptimo/shared/i18n';
import { keyReply } from './key-reply.js';
import { tidyGlued } from './page-model.js';
import type { FiguresPart } from './printed.js';

/** The catalogue's English as a `t`, so a test reads the words a reader would. */
export const testT = ((key: string) => (en as Record<string, string>)[key] ?? key) as TFunction;

/** The engine's frozen answer for one key (the 11 November plant), as the part of the figures reply an adapter reads. */
export function answerKey(file: string, key: string, owner: number): FiguresPart {
  const value = JSON.parse(
    readFileSync(
      new URL(`../../../../../../fixtures/answer-key/${file}.json`, import.meta.url),
      'utf8',
    ),
  ) as { asOf: string };
  return keyReply(key, owner, value);
}

/** Every string the engine printed in a value, cells and labels alike, so a test can ask whether the screen shows each. */
export function printedStrings(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') into.add(value);
  else if (typeof value === 'number') into.add(String(value));
  else if (Array.isArray(value)) for (const item of value) printedStrings(item, into);
  else if (typeof value === 'object' && value !== null)
    for (const item of Object.values(value)) printedStrings(item, into);
  return into;
}

/** The tables of an engine key's page, as the engine printed them. */
export type KeyTable = { title: string; header: string[]; rows: string[][] };
export const keyPage = (reply: FiguresPart) =>
  (
    reply.figures[0]!.value as {
      pages: {
        kpis: { label: string; value: string; sub: string }[];
        tables: KeyTable[];
        charts: { id: string }[];
      }[];
    }
  ).pages[0]!;

/** Every cell text a screen's tables print. */
export const shownCells = (tables: { rows: { text: string }[][] }[]): Set<string> =>
  new Set(tables.flatMap((table) => table.rows.flatMap((row) => row.map((cell) => cell.text))));

/** The cells the engine printed in these tables that no table of the screen shows, apart from the glued row labels. */
export function missingCells(printed: KeyTable[], shown: Set<string>): string[] {
  const glued = /(BD % \/ PM %|MTTR \/ MTBF)/;
  return printed
    .flatMap((table) => table.rows.flat())
    .filter(
      (cell) => !glued.test(cell) && !shown.has(tidyGlued(cell)) && !shown.has(`Cell ${cell}`),
    );
}
