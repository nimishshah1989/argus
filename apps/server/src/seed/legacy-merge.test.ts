import { describe, expect, it } from 'vitest';
import { DEFAULT_SWITCHES } from './legacy-classify.js';
import { convertLegacy } from './legacy-export.js';
import { KNOWN, serial, sheet } from './legacy-fixture.js';
import { readSheet, type LegacyRow } from './legacy-sheets.js';

/** Invented grids for what the real files showed: a machine written twice on one power-cut day, and "Maint. Team <name>". */
const uti = (day: string, minutes: number) => ({
  date: serial(day),
  problem: 'Power cut',
  code: 'UTI',
  em: 'E',
  minutes,
});
const rows = (): LegacyRow[] =>
  [
    [
      'ZZ-1',
      [
        uti('2022-08-10', 30),
        uti('2022-08-10', 45),
        { date: serial('2022-08-11'), minutes: 20, doneBy: 'Maint. Team Zorbo' },
      ],
    ],
    ['ZZ-2', [uti('2022-08-10', 15)]],
  ].flatMap(
    ([name, lines]) => readSheet(2022, name as string, sheet(lines as never), KNOWN)?.rows ?? [],
  );

describe('legacy export, real-file traps', () => {
  it('writes one line per machine for a power-cut day, summing its rows, and the identity still holds', () => {
    const { files, reports } = convertLegacy(
      rows(),
      { machines: KNOWN, people: [], terms: [] },
      DEFAULT_SWITCHES,
    );
    const out = JSON.parse(files[0]?.json ?? '{}') as {
      tickets: {
        entryType: string;
        events: { type: string; payload: { machineCode: string; minutes: number } }[];
      }[];
    };
    const event = out.tickets.find((t) => t.entryType === 'pastUtility');
    const lines = event?.events
      .filter((e) => e.type === 'utility_loss')
      .map((e) => [e.payload.machineCode, e.payload.minutes]);
    expect(lines).toEqual([
      ['ZZ-1', 75],
      ['ZZ-2', 15],
    ]);
    expect(reports[0]).toMatchObject({ identity: true, utilityMerged: 1, events: 1 });
  });

  it('does not take the words of the team code for a leaked name when a cell reads "Maint. Team <name>"', () => {
    expect(() =>
      convertLegacy(rows(), { machines: KNOWN, people: [], terms: [] }, DEFAULT_SWITCHES),
    ).not.toThrow();
  });
});
