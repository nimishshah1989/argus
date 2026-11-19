import { describe, expect, it } from 'vitest';
import type { ClassifiedRow, RowClass } from '../apps/server/src/seed/legacy-classify.js';
import type { Difference } from './legacy-check.js';
import { explain } from './legacy-explain.js';

/** Invented rows of one machine-month; the sheet's pair is MTTR and MTBF as the sheets print them. */
const row = (
  excelRow: number,
  minutes: number,
  over: { cls?: RowClass; code?: string; hours?: number | null } = {},
): ClassifiedRow =>
  ({
    cls: over.cls ?? 'ticket',
    machine: 'ZZ-1',
    row: {
      excelRow,
      minutes,
      code: over.code ?? 'M',
      utiHours: 0,
      hours: over.hours === undefined ? minutes / 60 : over.hours,
    },
  }) as unknown as ClassifiedRow;
const diff = (mttr: number | null, mtbf: number | null): Difference => ({
  machine: 'ZZ-1',
  month: '2022-07',
  sheet: { mttr, mtbf },
  loaded: { count: 0, hours: 0 },
});

describe('legacy explain', () => {
  const four = [row(5, 60), row(6, 60), row(7, 60), row(8, 120)];

  it('names a range that stops short and one that starts late', () => {
    expect(explain(diff(1, 250), four)).toBe('sheet range stops short (first rows only)');
    expect(explain(diff(1.5, 250), four)).toBe('sheet range starts late (last rows only)');
  });

  it('names blank-minute rows and held-out gap rows the sheet counts', () => {
    const blank = [row(5, 60), row(6, 0)];
    expect(explain(diff(0.5, 250), blank)).toBe(
      'sheet counts the loaded breakdowns + blank-minute rows',
    );
    const gap = [row(5, 60, { cls: 'gap_month' }), row(6, 0, { cls: 'gap_month' })];
    expect(explain(diff(0.5, 250), gap)).toMatch(/blank-minute rows \+ held-out gap-month rows/);
  });

  it('names a code the sheet leaves out, and the hours column when the minutes disagree with it', () => {
    const codes = [row(5, 60), row(6, 480, { code: 'X' }), row(7, 60)];
    expect(explain(diff(1, 250), codes)).toBe('sheet leaves out code X');
    const typed = [row(5, 60, { hours: 3 }), row(6, 60, { hours: 3 })];
    expect(explain(diff(3, 250), typed)).toMatch(/hours from the log's hours column/);
  });

  it('says unexplained when no rule gives the sheet its pair', () => {
    expect(explain(diff(9, 100), four)).toBe('unexplained');
  });
});
