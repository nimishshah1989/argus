import { describe, expect, it } from 'vitest';
import type { PageTable } from '../../analytics/page-content.js';
import { unpair } from './pair.js';
import { answerKey, keyPage } from './test-support.js';

const words = {
  title: '{title} · {measure}',
  fallback: ['Jobs', 'Hours'] as const,
  count: 'Count',
};
const asPage = (t: { title: string; header: string[]; rows: string[][] }): PageTable => ({
  ...t,
  rowCount: t.rows.length,
  truncated: false,
});

describe('a month-on-month matrix the platform printed as pairs of rows', () => {
  const a1 = keyPage(answerKey('a1-bd-pm', 'a1-bd-pm', 40)).tables[1]!;
  const halves = unpair(asPage(a1), words)!;

  it('becomes one table per measure, named by the measure the engine printed', () => {
    expect(halves.map((h) => h.title)).toEqual([`${a1.title} · BD %`, `${a1.title} · PM %`]);
    expect(halves.map((h) => h.rows.length)).toEqual([10, 10]);
  });

  it('puts the second measure under its own month, not one column to the left', () => {
    const [bd, pm] = halves;
    expect(bd!.header).toEqual(a1.header);
    expect(bd!.rows[0]!.slice(0, 3)).toEqual(['Cell 1', '0.34%', '0.35%']);
    expect(pm!.rows[0]!.slice(0, 3)).toEqual(['Cell 1', '0.00%', '0.00%']);
    expect(pm!.rows[0]!.length).toBe(a1.header.length);
    expect(bd!.rows.at(-1)![0]).toBe('PLANT TOTAL');
  });

  it('keeps every figure the engine printed', () => {
    const printed = a1.rows.flat().filter((cell) => !/BD % \/ PM %/.test(cell));
    const shown = new Set(halves.flatMap((h) => h.rows.flat()));
    expect(printed.filter((cell) => !shown.has(cell))).toEqual([]);
  });

  it('keeps the breakdown count the engine printed beside a label as its own column', () => {
    const a3 = keyPage(answerKey('a3-mttr-mtbf', 'a3-mttr-mtbf', 40)).tables[2]!;
    const [mttr] = unpair(asPage(a3), words)!;
    expect(mttr!.header.slice(0, 2)).toEqual(['Cell', 'Count']);
    expect(mttr!.rows[0]!.slice(0, 3)).toEqual(['Cell 1', '80', '1.18']);
  });

  it('names the two measures from the catalogue when the engine names none (the PM matrix)', () => {
    const a4 = keyPage(answerKey('a4-manpower', 'a4-manpower', 41)).tables[1]!;
    const halves4 = unpair(asPage(a4), words)!;
    expect(halves4.map((h) => h.title.split(' · ')[1])).toEqual(['Jobs', 'Hours']);
    expect(halves4[1]!.rows[0]!.slice(0, 5)).toEqual(['Person 51', '—', '—', '—', '7.8']);
  });

  it('leaves a table that is not a pair alone', () => {
    const cells = keyPage(answerKey('a1-bd-pm', 'a1-bd-pm', 40)).tables[0]!;
    expect(unpair(asPage(cells), words)).toBeNull();
  });
});
