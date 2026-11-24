import { describe, expect, it } from 'vitest';
import { DEFAULT_SWITCHES, classifyLegacy } from '../legacy-classify.js';
import { convertLegacy, type PlantContext } from '../legacy-export.js';
import { KNOWN, fixtureRows } from '../legacy-fixture.js';
import type { LegacyRow } from '../legacy-sheets.js';
import { trayCsv, trayOf } from '../legacy-tray.js';

const SENTINEL = 'ZZ-Alpha pressed the wrong key';

const row = (shift: string, excelRow: number, extra: Partial<LegacyRow> = {}): LegacyRow => ({
  year: 2022,
  machine: 'ZZ-1',
  excelRow,
  date: `2022-10-${String(excelRow - 80).padStart(2, '0')}`,
  shift,
  problem: 'Spindle alarm',
  observedBy: 'Operator',
  correctiveAction: '',
  doneBy: 'Maint. Team',
  minutes: 37,
  blankMinutes: false,
  code: 'M',
  elecMech: 'M',
  pmHours: 0,
  utiHours: 0,
  hours: null,
  ...extra,
});

const switches = { ...DEFAULT_SWITCHES, star: {} };
const plant: PlantContext = { machines: KNOWN, people: [], terms: [] };

describe('legacy shifts (hidden)', () => {
  it('holds "1 & 2" and a blank shift', () => {
    const { rows } = classifyLegacy([row('1 & 2', 81), row('', 82)], KNOWN, switches);
    expect(rows.map((c) => c.cls)).toEqual(['held_shift', 'held_shift']);
  });

  it('keeps a utility row with a third shift as a plant event, and out of the tray', () => {
    const uti = row('3RD', 81, { code: 'UTI', elecMech: 'E', minutes: 0, utiHours: 2 });
    const { rows } = classifyLegacy([uti], KNOWN, switches);
    expect(rows.map((c) => c.cls)).toEqual(['utility']);
    expect(trayOf(rows)).toEqual([]);
    const { files } = convertLegacy([...fixtureRows(), uti], plant, switches);
    expect(files.map((f) => [f.year, f.tickets, f.events])).toEqual([
      [2022, 14, 3],
      [2023, 4, 0],
    ]);
  });

  it('holds the identity in both years when held rows are in both workbooks', () => {
    const rows = [
      ...fixtureRows(),
      row('3RD', 81),
      row('', 82),
      row('1 & 2', 83, { year: 2023, date: '2023-03-03' }),
    ];
    const { files, reports } = convertLegacy(rows, plant, switches);
    expect(reports.map((r) => [r.heldShift, r.identity])).toEqual([
      [2, true],
      [1, true],
    ]);
    for (const file of files) {
      const out = JSON.parse(file.json) as { tickets: { reports: { shiftCode: string }[] }[] };
      const codes = new Set(out.tickets.flatMap((t) => t.reports.map((r) => r.shiftCode)));
      expect([...codes].every((c) => c === '1' || c === '2')).toBe(true);
    }
  });

  it('carries the shift as written and no other cell into the tray', () => {
    const cells = { problem: SENTINEL, observedBy: SENTINEL, doneBy: SENTINEL };
    const held = [row('13TH', 81, cells), row('1 & 2', 82, cells)];
    const tray = trayOf(classifyLegacy(held, KNOWN, switches).rows);
    expect(tray.map((t) => t.shift)).toEqual(['13TH', '1 & 2']);
    for (const t of tray)
      expect(Object.keys(t).sort()).toEqual(['excelRow', 'machine', 'reason', 'shift', 'year']);
    const csv = trayCsv(tray);
    expect(csv).toContain('2022,ZZ-1,82,held_shift,1 & 2\n');
    expect(csv).not.toContain('ZZ-Alpha');
    expect(csv).not.toContain('37');
  });

  it('quotes a written shift that holds a comma or a quote, so the csv keeps five columns', () => {
    const csv = trayCsv([
      { year: 2022, machine: 'ZZ-1', excelRow: 81, reason: 'held_shift', shift: '1,2' },
      { year: 2022, machine: 'ZZ-1', excelRow: 82, reason: 'held_shift', shift: '3"RD' },
    ]);
    expect(csv.split('\n').slice(1, 3)).toEqual([
      '2022,ZZ-1,81,held_shift,"1,2"',
      '2022,ZZ-1,82,held_shift,"3""RD"',
    ]);
  });
});
