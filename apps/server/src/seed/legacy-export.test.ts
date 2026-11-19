import { describe, expect, it } from 'vitest';
// The test sits beside the seed tool; the boundary checker skips *.test.ts (as in breakdown-log-export.test.ts).
// eslint-disable-next-line no-restricted-imports
import { parseSyntheticExport, parseTicket } from '../modules/imports/schema.js';
import { DEFAULT_SWITCHES, type Switches } from './legacy-classify.js';
import { convertLegacy, type PlantContext } from './legacy-export.js';
import { KNOWN, fixtureRows } from './legacy-fixture.js';

const plant: PlantContext = { machines: KNOWN, people: [], terms: [] };
const convert = (switches: Partial<Switches> = {}, over: Partial<PlantContext> = {}) =>
  convertLegacy(
    fixtureRows(),
    { ...plant, ...over },
    { ...DEFAULT_SWITCHES, star: {}, ...switches },
  );
type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const tickets = (year: number, switches: Partial<Switches> = {}): Obj[] =>
  (JSON.parse(convert(switches).files.find((f) => f.year === year)?.json ?? '{}') as Obj).tickets;

describe('legacy export', () => {
  it('writes one file per workbook year that parses (hand-worked: 16 tickets + 2 events in 2022)', () => {
    const { files } = convert();
    expect(files.map((f) => [f.year, f.tickets, f.events])).toEqual([
      [2022, 14, 2],
      [2023, 4, 0],
    ]);
    for (const file of files) {
      const parsed = parseSyntheticExport(JSON.parse(file.json));
      for (const t of parsed.tickets as Obj[]) {
        if (t.entryType === 'pastBreakdown') parseTicket(t);
      }
    }
  });

  it('places a ticket as 37c does: close at the shift start + 120 min, reported before it by the downtime', () => {
    const t = tickets(2022);
    const first = t[0] as Obj;
    expect(first).toMatchObject({
      ref: 'BD-20001',
      legacyId: 'lg-2022-bd-ZZ-1-5',
      machineCode: 'ZZ-1',
    });
    expect([first.reportedAt, first.state.closedAt]).toEqual([
      '2022-11-03T04:00:00.000Z',
      '2022-11-03T04:30:00.000Z',
    ]);
    const night = t[1] as Obj;
    expect(night.state.closedAt).toBe('2022-06-01T14:59:00.000Z');
    expect(night.reports[0]).toMatchObject({
      shiftCode: '2',
      downtimeMin: 45,
      breakdownCategory: 'E',
    });
    const long = t[2] as Obj;
    expect([long.reportedAt, long.state.closedAt]).toEqual([
      '2022-07-02T04:30:00.000Z',
      '2022-07-04T04:30:00.000Z',
    ]);
    expect(long.reports[0].repairMin).toBe(2880);
  });

  it('folds shifts (3ND to 2, stray to 1), keeps a blank code null and a blank minute 0', () => {
    const t = tickets(2022);
    expect((t[3] as Obj).reports[0]).toMatchObject({
      shiftCode: '2',
      maintCode: null,
      downtimeMin: 0,
    });
    expect((t[4] as Obj).reports[0].shiftCode).toBe('1');
    expect((t[5] as Obj).reports[0].shiftCode).toBe('1');
  });

  it('turns the utility rows of a plant date into one closed general ticket with one line per machine', () => {
    const events = tickets(2022).filter((t) => t.entryType === 'pastUtility');
    expect(events.map((e) => [e.ref, e.legacyId, e.events.length])).toEqual([
      ['WR-20222', 'lg-2022-uti-2022-08-10', 6],
      ['WR-20223', 'lg-2022-uti-2022-08-11', 4],
    ]);
    const day = events[0] as Obj;
    expect(day).toMatchObject({
      kind: 'general',
      status: 'closed',
      machineCode: null,
      location: 'Plant',
      workType: 'Utility failure',
      reports: [],
    });
    expect(day.events.map((e: Obj) => e.type)).toEqual([
      'down',
      ...Array(4).fill('utility_loss'),
      'close',
    ]);
    expect(
      day.events.slice(1, 5).map((e: Obj) => [e.payload.machineCode, e.payload.minutes]),
    ).toEqual([
      ['ZZ-1', 90],
      ['ZZ-2', 45],
      ['ZZ-3', 120],
      ['ZZ-4', 30],
    ]);
    expect(day.events[5]).toMatchObject({ by: null, payload: { kind: 'done' } });
    expect(day.storedFigures).toMatchObject({ responseMin: null, followMin: null, downtimeMin: 0 });
    expect([day.reportedAt, day.state.closedAt]).toEqual([
      '2022-08-10T02:30:00.000Z',
      '2022-08-10T04:30:00.000Z',
    ]);
  });

  it('loads a moved row under its own date in its workbook file and drops the repeated one', () => {
    const t = tickets(2023);
    expect(t.map((x) => x.reports[0].date)).toEqual([
      '2022-12-15',
      '2023-01-10',
      '2023-01-11',
      '2023-01-12',
    ]);
    expect(t[0]?.ref).toBe('BD-30002');
  });

  it('is byte-identical on a second run; S1 on keeps every earlier ref and adds only the Star rows', () => {
    expect(convert().files.map((f) => f.json)).toEqual(convert().files.map((f) => f.json));
    const before = tickets(2022);
    const after = tickets(2022, { star: DEFAULT_SWITCHES.star });
    const idOf = (t: Obj) => t.legacyId as string;
    const kept = after.filter((t) => before.some((b) => idOf(b) === idOf(t)));
    expect(kept.map((t) => JSON.stringify(t))).toEqual(before.map((t) => JSON.stringify(t)));
    expect(
      after.filter((t) => !before.some((b) => idOf(b) === idOf(t))).map((t) => t.machineCode),
    ).toEqual(['S-1', 'S-1', 'S-1']);
  });

  it('keeps codes as written except the folded MEC and ELE', () => {
    const rows = fixtureRows().map((r, i) =>
      i === 0
        ? { ...r, code: 'MEC' }
        : i === 1
          ? { ...r, code: 'ELE' }
          : i === 2
            ? { ...r, code: 'TR' }
            : r,
    );
    const out = JSON.parse(
      convertLegacy(rows, plant, { ...DEFAULT_SWITCHES, star: {} }).files[0]?.json ?? '{}',
    ) as Obj;
    expect(out.tickets.slice(0, 3).map((t: Obj) => t.reports[0].maintCode)).toEqual([
      'M',
      'E',
      'TR',
    ]);
    expect(Object.keys(out.aliases.maintenanceCodes)).toContain('TR');
  });

  it('puts no name, phone number or workbook person in the output, and refuses a file that would', () => {
    const json = convert()
      .files.map((f) => f.json)
      .join('')
      .toLowerCase();
    for (const word of ['zorbo', 'quixle', 'vimpl', 'narden', '9876543210'])
      expect(json).not.toContain(word);
    const first = tickets(2022)[0] as Obj;
    expect(first.problem).toBe('[person] checked the valve, call [phone]');
    expect(first.reports[0].doneBy).toHaveLength(2);
    expect(first.reports[0].doneBy[0]).toMatch(/^LG-[0-9a-f]{8}$/);
    const leaky = { ...plant, machines: new Set([...KNOWN, 'ZORBO-1']) };
    const rows = fixtureRows().map((r, i) => (i === 0 ? { ...r, machine: 'ZORBO-1' } : r));
    expect(() => convertLegacy(rows, leaky, { ...DEFAULT_SWITCHES, star: {} })).toThrow(
      /name token/,
    );
    expect(() => convert({}, { terms: ['ZZ-2'] })).toThrow(/name token/);
  });

  it('uses the tenant person code on an exact match', () => {
    const people = [{ name: 'zorbo quixle', code: 'P-0a1b2c3d' }];
    const out = JSON.parse(convert({}, { people }).files[0]?.json ?? '{}') as Obj;
    expect(out.tickets[0].reports[0].doneBy[0]).toBe('P-0a1b2c3d');
  });
});
