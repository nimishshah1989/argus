import type { EngineData } from '../packages/domain/src/index.js';
import { describe, expect, it } from 'vitest';
import type { Cell } from '../apps/server/src/seed/legacy-sheets.js';
import {
  compare,
  formatDifference,
  loadedFigures,
  parseSummary,
  type Loaded,
} from './legacy-check.js';

/** An invented pair of summary sheets: months across, machines down, hours in the cells. */
const MTTR: Cell[][] = [
  ['Title row'],
  ['Machine', 'Jan', 'Feb', 'Mar', 'Total'],
  ['ZZ-1', 0.89, null, 2, 1.1],
  ['ZZ-2', 1.5, null, null, null],
  ['ZZ-3', null, 0.5, null, null],
  ['STAR-9', 3, null, null, null],
];
const MTBF: Cell[][] = [
  ['Machine', 'JAN-22', 'FEB-22', 'Mar 2022'],
  ['ZZ-1', 166.67, null, 250],
  ['ZZ-2', 500, null, null],
  ['ZZ-3', 500, 500, 500],
  ['STAR-9', 100, null, null],
];
const sheets = { 'MTTR 2022': MTTR, MTBF: MTBF, 'MTTR & MTBF': [['x']], 'ZZ-1': [['not read']] };
const machineOf = (label: string): string | null => (label.startsWith('ZZ-') ? label : null);

describe('legacy check', () => {
  it('reads the two summary sheets by their month header and names a label that is no plant machine', () => {
    const summary = parseSummary(sheets, 2022, machineOf);
    expect(summary.cells.get('ZZ-1 2022-01')).toEqual({ mttr: 0.89, mtbf: 166.67 });
    expect(summary.cells.get('ZZ-1 2022-03')).toEqual({ mttr: 2, mtbf: 250 });
    expect(summary.cells.get('ZZ-1 2022-02')).toEqual({ mttr: null, mtbf: null });
    expect(summary.cells.size).toBe(9);
    expect(summary.notPlant).toEqual(['STAR-9']);
    expect(summary.unreadable).toBe(0);
  });

  it('counts a summary sheet with no month header as unreadable instead of guessing', () => {
    const summary = parseSummary(
      {
        'MTBF 2023': [
          ['a', 'b'],
          ['ZZ-1', 3],
        ],
      },
      2023,
      machineOf,
    );
    expect(summary.unreadable).toBe(1);
    expect(summary.cells.size).toBe(0);
  });

  it('prints equal for every machine-month that matches and names the one pair that does not', () => {
    const loaded = new Map<string, Loaded>([
      ['ZZ-1 2022-01', { count: 3, hours: 2.67 }],
      ['ZZ-1 2022-03', { count: 2, hours: 4 }],
      ['ZZ-2 2022-01', { count: 1, hours: 1 }],
      ['ZZ-3 2022-02', { count: 1, hours: 0.5 }],
    ]);
    const result = compare(parseSummary(sheets, 2022, machineOf), loaded);
    expect(result).toMatchObject({ compared: 9, equal: 8 });
    expect(result.different.map(formatDifference)).toEqual([
      'ZZ-2 2022-01: sheet MTTR 1.50 MTBF 500.00 | loaded 1 / 1.00 h / MTTR 1.00 / MTBF 500.00 / availability 0.99800',
    ]);
  });

  it('names a month the database has breakdowns in that the sheet shows as none', () => {
    const loaded = new Map<string, Loaded>([['ZZ-3 2022-03', { count: 1, hours: 2 }]]);
    const result = compare(parseSummary(sheets, 2022, machineOf), loaded);
    expect(result.different.map((d) => `${d.machine} ${d.month}`)).toContain('ZZ-3 2022-03');
  });

  it('counts a non-PM report with downtime, per plant machine and month, and nothing else', () => {
    const data = {
      machines: [{ id: 'm1', code: 'ZZ-1' }],
      reports: [
        { machineId: 'm1', date: '2022-01-05', downtimeMin: 60, maintCode: 'E' },
        { machineId: 'm1', date: '2022-01-20', downtimeMin: 30, maintCode: null },
        { machineId: 'm1', date: '2022-01-21', downtimeMin: 90, maintCode: 'PM' },
        { machineId: 'm1', date: '2022-01-22', downtimeMin: 0, maintCode: 'E' },
        { machineId: 'm2', date: '2022-01-22', downtimeMin: 10, maintCode: 'E' },
      ],
    } as unknown as EngineData;
    expect([...loadedFigures(data)]).toEqual([['ZZ-1 2022-01', { count: 2, hours: 1.5 }]]);
  });
});
