import { describe, expect, it } from 'vitest';
import { DEFAULT_SWITCHES } from './legacy-classify.js';
import { convertLegacy, writtenIdentity } from './legacy-export.js';
import { KNOWN, serial, sheet } from './legacy-fixture.js';
import { createPeople } from './legacy-people.js';
import { readSheet, type LegacyRow } from './legacy-sheets.js';

/** Review findings on the real-file fixes: code conflicts, an identity that sees a lost line, and the team prefix. */
const plant = { machines: KNOWN, people: [], terms: [] };
const power = (day: string, minutes: number, code: string) => ({
  date: serial(day),
  problem: 'Power cut',
  code,
  em: 'E',
  minutes,
});
const read = (name: string, lines: unknown[]): LegacyRow[] =>
  readSheet(2022, name, sheet(lines as never), KNOWN)?.rows ?? [];
type Out = {
  tickets: { entryType: string; events: { type: string; payload: { code: string } }[] }[];
};

describe('plant event merge rules', () => {
  it('keeps the first non-blank code of a machine written twice, and counts two different codes as a conflict', () => {
    const rows = [
      ...read('ZZ-1', [
        { ...power('2022-08-10', 30, ''), minutes: undefined, uti: 0.5 },
        power('2022-08-10', 45, 'UTY'),
      ]),
      ...read('ZZ-2', [power('2022-08-10', 30, 'UTI'), power('2022-08-10', 45, 'UTY')]),
    ];
    const { files, reports } = convertLegacy(rows, plant, DEFAULT_SWITCHES);
    const out = JSON.parse(files[0]?.json ?? '{}') as Out;
    const codes = out.tickets[0]?.events
      .filter((e) => e.type === 'utility_loss')
      .map((e) => e.payload.code);
    expect(codes).toEqual(['UTY', 'UTI']);
    expect(reports[0]).toMatchObject({ utilityMerged: 2, utilityCodeConflicts: 1, identity: true });
  });

  it('breaks the identity when a line goes missing, because the merged rows are counted from the input', () => {
    const rows = [
      ...read('ZZ-1', [power('2022-08-10', 30, 'UTI'), power('2022-08-10', 45, 'UTI')]),
      ...read('ZZ-2', [power('2022-08-10', 15, 'UTI')]),
    ];
    const { files, reports } = convertLegacy(rows, plant, DEFAULT_SWITCHES);
    const out = JSON.parse(files[0]?.json ?? '{}') as Out;
    out.tickets[0]?.events.splice(1, 1);
    expect(writtenIdentity(reports[0] as never, JSON.stringify(out))).toBe(false);
  });
});

describe('the team code and real names', () => {
  it('converts a plain Maint. Team row beside a "Maint. Team <name>" cell and keeps the name out', () => {
    const rows = read('ZZ-1', [
      { date: serial('2022-08-10'), minutes: 20, doneBy: 'Maint. Team' },
      { date: serial('2022-08-11'), minutes: 20, doneBy: 'Maint. Team Zorbo' },
    ]);
    const { files } = convertLegacy(rows, plant, DEFAULT_SWITCHES);
    const json = files[0]?.json ?? '';
    const reports = (JSON.parse(json) as { tickets: { reports: { doneBy: string[] }[] }[] })
      .tickets;
    expect(reports[0]?.reports[0]?.doneBy).toEqual(['Maint. Team']);
    expect(json.toLowerCase()).not.toContain('zorbo');
  });

  it('still redacts a person whose own name holds Team or Maint', () => {
    const people = createPeople([], [], ['Quixle Team', 'Maint Vimpl', 'Maint. Team Narden']);
    expect(people.redact('Quixle Team and Maint Vimpl came, Narden too')).toBe(
      '[person] [person] and [person] [person] came, [person] too',
    );
    expect(people.redact('Maint. Team helped')).toBe('[person]. [person] helped');
  });

  it('converts a cell that reads "<name> Team" and keeps the name out, the team code being no leak', () => {
    const rows = read('ZZ-1', [
      { date: serial('2022-08-10'), minutes: 20, doneBy: 'Quixle Team' },
      { date: serial('2022-08-11'), minutes: 20, doneBy: 'Maint. Team' },
    ]);
    const { files } = convertLegacy(rows, plant, DEFAULT_SWITCHES);
    expect((files[0]?.json ?? '').toLowerCase()).not.toContain('quixle');
  });
});
