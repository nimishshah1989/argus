import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// The test sits beside the seed tool, so the module-boundary rule would block the real contract import. The
// boundary checker skips *.test.ts; this one import is exempted so the test parses with the actual schema.
// eslint-disable-next-line no-restricted-imports
import { canonicalJson, parseSyntheticExport, parseTicket } from '../modules/imports/schema.js';
import { breakdownLogExport } from './breakdown-log-export.js';

interface FixtureRow {
  id: string;
  machineId: string;
  date: string;
  shift: string;
  problem: string;
  observedBy: string;
  correctiveAction: string;
  doneBy: string;
  supportedBy: string;
  downMin: number;
  respMin?: number;
  maintCode: string;
  electMech: string;
  spare1?: string;
  spare2?: string;
  spare3?: string;
  srNo: number;
}

interface FixtureMachine {
  id: string;
}

interface Fixture {
  machines: FixtureMachine[];
  convMachines: FixtureMachine[];
  procMachines: FixtureMachine[];
  utilMachines: FixtureMachine[];
  dgMachines: FixtureMachine[];
  breakdowns: FixtureRow[];
}

interface RawTicket {
  legacyId: string;
  ref: string;
  entryType: string;
  kind: string;
  status: string;
  machineCode: string | null;
  problem: string;
  reportedAt: string;
  state: {
    closedAt: string | null;
    closeKind: string | null;
    closedByPerson: string | null;
  };
  events: Array<{
    type: string;
    at: string;
    by: string | null;
    text: string | null;
    payload: Record<string, unknown>;
  }>;
  reports: Array<{
    date: string;
    shiftCode: string;
    problem: string;
    observedBy: string | null;
    correctiveAction: string | null;
    downtimeMin: number;
    responseMin: number | null;
    repairMin: number | null;
    maintCode: string | null;
    breakdownCategory: string | null;
    spareUsed: string | null;
    doneBy: string[];
    supportedBy: string[];
    submittedAt: string;
    submittedBy: string;
  }>;
  storedFigures: {
    responseMin: number | null;
    downtimeMin: number | null;
    repairMin: number;
  };
}

interface SeededShift {
  code: string;
  startsAt: string;
  endsAt: string;
  crossesMidnight: boolean;
}

const SLICE_URL = (path: string) => new URL(path, import.meta.url);
const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(fileURLToPath(SLICE_URL(path)), 'utf8')) as T;
const fixture = readJson<Fixture>('../../../../fixtures/answer-key/input.json');
const shifts = readJson<SeededShift[]>('./cosmos-shifts.json');
const exported = breakdownLogExport(fixture);
const tickets = exported.tickets as RawTicket[];
const LIVE_PREFIX = 'bd_live_';
const UNKNOWN_CODES = ['NI', 'FS', 'PP', 'UTI'];
const OBSERVED_BY = new Set(['Operator', 'Setter', 'Supervisor', 'Engineer']);
const PLANT_ZONE = 'Asia/Kolkata';
const MINUTE = 60_000;
const liveRows = fixture.breakdowns.filter((row) => row.id.startsWith(LIVE_PREFIX));
const historyRows = fixture.breakdowns.filter((row) => !row.id.startsWith(LIVE_PREFIX));
const byId = new Map(historyRows.map((row) => [row.id, row]));
const minutesBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / MINUTE;
const normalizeName = (value: string) =>
  value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
const namesIn = (value: string): string[] => {
  const seen = new Set<string>();
  return value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => {
      if (!name || seen.has(normalizeName(name))) return false;
      seen.add(normalizeName(name));
      return true;
    });
};
const toCalendarDate = (value: string): string => {
  const [day = '', month = '', year = ''] = value.split('-');
  return `${year}-${month}-${day}`;
};
const shiftFor = (code: string): SeededShift => {
  const shift = shifts.find((candidate) => candidate.code === code);
  if (!shift) throw new Error(`fixture has no seeded shift ${code}`);
  return shift;
};
const shiftSeconds = (value: string): number => {
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  return hour * 3600 + minute * 60;
};
const localParts = (iso: string): { date: string; seconds: number } => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PLANT_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    seconds: Number(get('hour')) * 3600 + Number(get('minute')) * 60 + Number(get('second')),
  };
};
const insideShift = (iso: string, shift: SeededShift): boolean => {
  const local = localParts(iso);
  const starts = shiftSeconds(shift.startsAt);
  const ends = shiftSeconds(shift.endsAt);
  return shift.crossesMidnight
    ? local.seconds >= starts || local.seconds < ends
    : local.seconds >= starts && local.seconds < ends;
};
const productionDate = (iso: string, shift: SeededShift): string => {
  const local = localParts(iso);
  if (!shift.crossesMidnight || local.seconds > shiftSeconds(shift.endsAt)) return local.date;
  const previous = new Date(`${local.date}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
};
const expectedShift = (value: string): string => {
  if (value === '1' || value === '1ST') return '1';
  if (value === '2' || value === '2ND' || value === '3') return '2';
  throw new Error(`unexpected fixture shift ${value}`);
};
const expectedObservedBy = (value: string): string | null => {
  const key = normalizeName(value);
  if (key === 'operator' || key === 'opeartor' || key === 'opeator') return 'Operator';
  if (key === 'setter') return 'Setter';
  if (key === 'supervisor') return 'Supervisor';
  if (key === 'engineer') return 'Engineer';
  return null;
};

describe('breakdownLogExport', () => {
  it('exports the 1,283 history rows and excludes the 60 live rows', () => {
    expect(fixture.breakdowns).toHaveLength(1343);
    expect(liveRows).toHaveLength(60);
    expect(historyRows).toHaveLength(1283);
    expect(tickets).toHaveLength(1283);
    expect(exported.source).toBe('argus.synthetic-bhavin/v1');
    const ids = tickets.map((ticket) => ticket.legacyId);
    for (const row of liveRows) expect(ids).not.toContain(row.id);
    expect(ids.some((id) => id.startsWith(LIVE_PREFIX))).toBe(false);
  });

  it('keeps every legacy id unique', () => {
    const ids = tickets.map((ticket) => ticket.legacyId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every ticket a unique reference in the BD-9 band, clear of the live refs', () => {
    const refs = tickets.map((ticket) => ticket.ref);
    expect(new Set(refs).size).toBe(refs.length);
    for (const ref of refs) {
      expect(ref).toMatch(/^BD-9\d{4}$/);
      const suffix = Number(ref.slice(3));
      expect(suffix).toBeGreaterThanOrEqual(90_001);
      expect(suffix).toBeLessThanOrEqual(91_357);
    }
    for (const row of historyRows) {
      const ticket = tickets.find((candidate) => candidate.legacyId === row.id);
      expect(ticket?.ref).toBe(`BD-${90_000 + row.srNo}`);
    }
    // The plant's live refs are BD-0001..BD-0151; the export must never land on one.
    expect(refs.every((ref) => Number(ref.slice(3)) > 151)).toBe(true);
  });

  it('falls back inside the same BD-9 band when two rows share a serial number', () => {
    const first = historyRows[0];
    const second = historyRows[1];
    if (!first || !second) throw new Error('fixture needs two history rows');
    const input = {
      ...fixture,
      breakdowns: [
        { ...first, srNo: first.srNo },
        { ...second, srNo: first.srNo },
      ],
    };
    const refs = (breakdownLogExport(input).tickets as RawTicket[]).map((ticket) => ticket.ref);
    expect(refs).toHaveLength(2);
    expect(new Set(refs).size).toBe(2);
    for (const ref of refs) {
      expect(ref).toMatch(/^BD-9\d{4}$/);
      expect(Number(ref.slice(3))).toBeGreaterThanOrEqual(90_001);
    }
  });

  it('validates the export and every ticket against the import schema', () => {
    expect(() => parseSyntheticExport(exported)).not.toThrow();
    for (const ticket of exported.tickets) expect(() => parseTicket(ticket)).not.toThrow();
  });

  it('normalizes 1ST to 1, 2ND to 2 and folds 3 into the night shift 2', () => {
    const codes = new Set(historyRows.map((row) => row.shift));
    expect(codes.has('1ST')).toBe(true);
    expect(codes.has('2ND')).toBe(true);
    expect(codes.has('3')).toBe(true);
    for (const ticket of tickets) {
      const row = byId.get(ticket.legacyId);
      expect(row).toBeDefined();
      if (!row) continue;
      expect(ticket.reports[0]?.shiftCode).toBe(expectedShift(row.shift));
      expect(['1', '2']).toContain(ticket.reports[0]?.shiftCode);
    }
  });

  it('ends every ticket inside its named shift on the row date, two hours after the start', () => {
    for (const ticket of tickets) {
      const row = byId.get(ticket.legacyId);
      expect(row).toBeDefined();
      if (!row) continue;
      const report = ticket.reports[0];
      const close = ticket.state.closedAt;
      expect(report).toBeDefined();
      expect(close).not.toBeNull();
      if (!report || !close) continue;
      const shift = shiftFor(report.shiftCode);
      const start = Date.parse(`${toCalendarDate(row.date)}T${shift.startsAt}:00+05:30`);
      expect(Date.parse(close)).toBe(start + 120 * MINUTE);
      expect(insideShift(close, shift)).toBe(true);
      expect(productionDate(close, shift)).toBe(toCalendarDate(row.date));
      expect(report.date).toBe(toCalendarDate(row.date));
    }
  });

  it('places a 14,400-minute downtime so only the close falls inside the shift', () => {
    const longest = historyRows.reduce((left, right) =>
      left.downMin >= right.downMin ? left : right,
    );
    expect(longest.downMin).toBe(14_400);
    const ticket = tickets.find((candidate) => candidate.legacyId === longest.id);
    expect(ticket).toBeDefined();
    if (!ticket) return;
    const report = ticket.reports[0];
    const close = ticket.state.closedAt;
    if (!report || !close) throw new Error('longest row has no report close');
    expect(Date.parse(close) - Date.parse(ticket.reportedAt)).toBe(14_400 * MINUTE);
    expect(insideShift(close, shiftFor(report.shiftCode))).toBe(true);
    // Ten days back is the same clock time, on the row date minus ten days; the close is what validateLocal checks.
    const tenDaysBefore = new Date(`${toCalendarDate(longest.date)}T00:00:00Z`);
    tenDaysBefore.setUTCDate(tenDaysBefore.getUTCDate() - 10);
    expect(localParts(ticket.reportedAt).date).toBe(tenDaysBefore.toISOString().slice(0, 10));
  });

  it('resolves the five unknown maintenance codes through the synthetic alias config', () => {
    const rows = historyRows.filter((row) => UNKNOWN_CODES.includes(row.maintCode));
    expect(rows).toHaveLength(5);
    expect(exported.aliases.maintenanceCodes).toEqual({
      MEC: 'M',
      NI: 'MIS',
      INT: 'MIS',
      FS: 'MIS',
      PP: 'MIS',
      UTI: 'MIS',
    });
    for (const row of rows) {
      const ticket = tickets.find((candidate) => candidate.legacyId === row.id);
      expect(ticket?.reports[0]?.maintCode).toBe(row.maintCode);
      expect(exported.aliases.maintenanceCodes[row.maintCode]).toBe('MIS');
    }
  });

  it('keeps a blank maintenance code and a blank category null', () => {
    const blank = fixture.breakdowns.filter((row) => !row.maintCode);
    expect(blank).toHaveLength(4);
    for (const row of blank) expect(row.id.startsWith(LIVE_PREFIX)).toBe(true);
    const base = historyRows[0];
    if (!base) throw new Error('fixture needs a history row');
    const crafted = { ...base, id: 'bd_crafted_blank', maintCode: '', electMech: '' };
    const [ticket] = breakdownLogExport({ breakdowns: [crafted] }).tickets as RawTicket[];
    expect(ticket?.reports[0]?.maintCode).toBeNull();
    expect(ticket?.reports[0]?.breakdownCategory).toBeNull();
  });

  it('carries the row response time into the report and stored figures', () => {
    const withResponse = fixture.breakdowns.filter((row) => 'respMin' in row);
    expect(withResponse).toHaveLength(17);
    for (const row of withResponse) expect(row.id.startsWith(LIVE_PREFIX)).toBe(true);
    const base = historyRows[0];
    if (!base) throw new Error('fixture needs a history row');
    const crafted = { ...base, id: 'bd_crafted_response', downMin: 60, respMin: 7 };
    const [ticket] = breakdownLogExport({ breakdowns: [crafted] }).tickets as RawTicket[];
    expect(ticket?.reports[0]?.responseMin).toBe(7);
    expect(ticket?.reports[0]?.repairMin).toBe(53);
    expect(ticket?.storedFigures.responseMin).toBe(7);
    expect(ticket?.storedFigures.downtimeMin).toBe(60);
    expect(ticket?.storedFigures.repairMin).toBe(53);
  });

  it('splits supportedBy like doneBy and never repeats a doneBy person', () => {
    for (const ticket of tickets) {
      const row = byId.get(ticket.legacyId);
      expect(row).toBeDefined();
      if (!row) continue;
      const doneBy = namesIn(row.doneBy);
      const doneKeys = new Set(doneBy.map(normalizeName));
      const expected = namesIn(row.supportedBy).filter(
        (name) => !doneKeys.has(normalizeName(name)),
      );
      expect(ticket.reports[0]?.doneBy).toEqual(doneBy);
      expect(ticket.reports[0]?.supportedBy).toEqual(expected);
    }
    expect(tickets.some((ticket) => (ticket.reports[0]?.supportedBy.length ?? 0) > 0)).toBe(true);
  });

  it('maps observedBy to the list value or null, never a person name', () => {
    for (const ticket of tickets) {
      const row = byId.get(ticket.legacyId);
      expect(row).toBeDefined();
      if (!row) continue;
      const observedBy = ticket.reports[0]?.observedBy ?? null;
      expect(observedBy).toBe(expectedObservedBy(row.observedBy));
      if (observedBy !== null) expect(OBSERVED_BY.has(observedBy)).toBe(true);
    }
    const typos = historyRows.filter((row) =>
      ['operator', 'Opeartor', 'Opeator'].includes(row.observedBy),
    );
    expect(typos).toHaveLength(6);
    for (const row of typos) {
      const ticket = tickets.find((candidate) => candidate.legacyId === row.id);
      expect(ticket?.reports[0]?.observedBy).toBe('Operator');
    }
    expect(tickets.some((ticket) => ticket.reports[0]?.observedBy === null)).toBe(true);
  });

  it('keeps the report times and stored figures consistent with the row', () => {
    for (const ticket of tickets) {
      const row = byId.get(ticket.legacyId);
      expect(row).toBeDefined();
      const report = ticket.reports[0];
      expect(report).toBeDefined();
      if (!row || !report) continue;
      const responseMin = row.respMin ?? 0;
      expect(ticket.entryType).toBe('pastBreakdown');
      expect(ticket.kind).toBe('stopped');
      expect(ticket.status).toBe('closed');
      expect(ticket.state.closeKind).toBe('report');
      expect(ticket.state.closedAt).not.toBeNull();
      expect(minutesBetween(ticket.reportedAt, ticket.state.closedAt as string)).toBe(row.downMin);
      expect(report.submittedAt).toBe(ticket.state.closedAt);
      expect(report.downtimeMin).toBe(row.downMin);
      expect(report.responseMin).toBe(responseMin);
      expect(report.repairMin).toBe(row.downMin - responseMin);
      expect(ticket.storedFigures.downtimeMin).toBe(row.downMin);
      expect(ticket.storedFigures.responseMin).toBe(responseMin);
      expect(ticket.storedFigures.repairMin).toBe(row.downMin - responseMin);
      expect(ticket.events).toHaveLength(2);
      expect(ticket.events[0]?.type).toBe('down');
      expect(ticket.events[1]?.type).toBe('close');
      expect(ticket.events[1]?.at).toBe(ticket.state.closedAt);
      expect(ticket.events[1]?.by).toBe(report.submittedBy);
      expect(ticket.events[1]?.payload).toEqual({ kind: 'report' });
      expect(ticket.state.closedByPerson).toBe(report.submittedBy);
    }
  });

  it('is deterministic: two runs give byte-identical canonical JSON', () => {
    expect(canonicalJson(breakdownLogExport(fixture))).toBe(canonicalJson(exported));
  });

  it('invents no machine or person: the aliases are identity over the exported rows', () => {
    const machineIds = new Set(
      [
        ...fixture.machines,
        ...fixture.convMachines,
        ...fixture.procMachines,
        ...fixture.utilMachines,
        ...fixture.dgMachines,
      ].map((machine) => machine.id),
    );
    const namedPeople = new Set(historyRows.flatMap((row) => namesIn(row.doneBy)));
    const machineNames = [...new Set(historyRows.map((row) => row.machineId))].sort();
    expect(Object.keys(exported.aliases.machines).sort()).toEqual(machineNames);
    expect(Object.keys(exported.aliases.people).sort()).toEqual([...namedPeople].sort());
    for (const [source, target] of Object.entries(exported.aliases.machines)) {
      expect(target).toBe(source);
    }
    for (const [source, target] of Object.entries(exported.aliases.people)) {
      expect(target).toBe(source);
    }
    for (const ticket of tickets) {
      expect(ticket.machineCode).not.toBeNull();
      expect(machineIds.has(ticket.machineCode as string)).toBe(true);
      const report = ticket.reports[0];
      if (!report) continue;
      for (const name of [...report.doneBy, report.submittedBy]) {
        expect(namedPeople.has(name)).toBe(true);
      }
    }
  });
});
