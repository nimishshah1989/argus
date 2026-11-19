import { describe, expect, it } from 'vitest';
import { DEFAULT_SWITCHES, classifyLegacy, type Switches } from './legacy-classify.js';
import { KNOWN, fixtureRows } from './legacy-fixture.js';

const run = (switches: Partial<Switches> = {}) =>
  classifyLegacy(fixtureRows(), KNOWN, { ...DEFAULT_SWITCHES, star: {}, ...switches });

describe('legacy classify', () => {
  it('gives every row one class and the counts are hand-worked (31 = 18 + 6 + 1 + 1 + 3 + 2)', () => {
    const [y22, y23] = run().reports;
    expect(y22).toMatchObject({ read: 26, tickets: 14, utilityRows: 6, strayYear: 1, gapMonth: 2 });
    expect(y22?.unknownMachine).toEqual({ 'STAR-1': 3 });
    expect(y23).toMatchObject({ read: 5, tickets: 4, duplicate: 1, movedOut: 1 });
    expect(y22?.movedIn).toBe(1);
  });

  it('counts blank code and blank minutes of the loaded tickets', () => {
    const [y22] = run().reports;
    expect(y22).toMatchObject({ blankCode: 1, blankMinutes: 1 });
    expect(y22?.codes['(blank)']).toBe(1);
  });

  it('numbers rows over every dated row, so a switch never renumbers a loaded row', () => {
    const before = run().rows.map((c) => [c.row.year, c.row.excelRow, c.machine, c.serial]);
    const after = run({ star: DEFAULT_SWITCHES.star, gap: [] }).rows.map((c) => [
      c.row.year,
      c.row.excelRow,
      c.machine === 'S-1' ? 'STAR-1' : c.machine,
      c.serial,
    ]);
    expect(after).toEqual(before);
  });

  it('S1 and S4 turn excluded rows into tickets', () => {
    const [y22] = run({ star: DEFAULT_SWITCHES.star, gap: [] }).reports;
    expect(y22).toMatchObject({ tickets: 19, gapMonth: 0 });
    expect(y22?.unknownMachine).toEqual({});
  });

  it('S2: a retired machine is excluded and counted by code, or loads with retired keep', () => {
    const rows = fixtureRows().map((r, i) => (i === 0 ? { ...r, machine: 'TC-2' } : r));
    const classify = (retired: 'drop' | 'keep') =>
      classifyLegacy(rows, KNOWN, { ...DEFAULT_SWITCHES, star: {}, retired }).reports[0];
    expect(classify('drop')).toMatchObject({
      tickets: 13,
      unknownMachine: { 'STAR-1': 3, 'TC-2': 1 },
    });
    expect(classify('keep')).toMatchObject({ tickets: 14, unknownMachine: { 'STAR-1': 3 } });
  });
});
