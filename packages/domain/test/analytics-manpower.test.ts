import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData, type FigureResult } from '../src/index.js';
import { effectiveHours, isPm, sourcedReports } from '../src/analytics/rows.js';
import { A4, ENGINE_DATA, type FigureKey } from './answer-key/fixture.js';

/**
 * The A4 manpower figure (packet 41a): the platform's whole page against the frozen 11 November key — the three
 * KPIs, the five tables and the chart, never a tolerance. The key is the authority; the assertions below also derive
 * the drill count and the two orders from the workbook so a hard-coded page cannot pass.
 */

const AS_OF = '2026-11-11';

function compute(data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === 'a4-manpower');
  if (!found) throw new Error('the engine knows no figure a4-manpower');
  return found;
}

function valueOf(data: EngineData = ENGINE_DATA): FigureKey {
  return compute(data).value as unknown as FigureKey;
}

function table(value: FigureKey, title: string) {
  const found = value.pages[0]?.tables.find((candidate) => candidate.title === title);
  if (!found) throw new Error(`the A4 page holds no table titled "${title}"`);
  return found;
}

/** The fixture always carries settings; the order tests read the team list and write it back. */
const SETTINGS = ENGINE_DATA.settings!;

/** Every CNC machine, the ones the plant leaves out of production data included: the machines A4 reads. */
const CNC = new Set(
  ENGINE_DATA.machines.filter((machine) => machine.segment === 'CNC').map((machine) => machine.id),
);

/** Every CNC report that is not PM: the rows the 1,279 breakdowns and the drill are derived from. */
const CARRIED = sourcedReports(ENGINE_DATA).filter(
  (row) => CNC.has(row.report.machineId) && !isPm(row),
);

describe('the A4 manpower figure', () => {
  it("equals the key's whole page: three KPIs, five tables and one chart", () => {
    const computed = compute();
    // Red first: the A4 computer had not landed, so the engine answered not_computed.
    expect(computed.status).toBe('ready');
    expect(computed.value).toEqual(A4);
  });

  it('drills the non-PM tickets of every CNC machine it read, derived from the workbook', () => {
    const computed = compute();
    const known = new Set(
      [...ENGINE_DATA.tickets, ...ENGINE_DATA.tasks].map((ticket) => ticket.id),
    );
    expect(CARRIED.length).toBeGreaterThan(0);
    expect(computed.drill.ids).toHaveLength(CARRIED.length);
    expect(computed.drill.ids).toEqual([...new Set(CARRIED.map((row) => row.ticket.id))].sort());
    expect(computed.drill.ids.every((id) => known.has(id))).toBe(true);
    // The history rows carry one id as both report and ticket (1,283 of 1,350), so a blanket "no report id"
    // cannot hold; what must hold is that no drill id is a report-only id (a live row whose two ids differ).
    const reportOnly = new Set(
      ENGINE_DATA.reports.filter((report) => !known.has(report.id)).map((report) => report.id),
    );
    expect(reportOnly.size).toBeGreaterThan(0);
    expect(computed.drill.ids.some((id) => reportOnly.has(id))).toBe(false);
    expect(computed.drill.type).toBe('ticket');
  });

  it('counts a breakdown row on a machine left out of production data: one more breakdown, its hours, its drill id', () => {
    // The key's one left-out machine is a Robot-category machine (never counted); this plant switched off a lathe.
    const left = ENGINE_DATA.machines.find((machine) => machine.excludedFromProduction)!;
    const excluded = {
      ...left,
      id: 'a4-left-out',
      category: 'Lathe',
      excludedFromProduction: true,
    };
    const donor = CARRIED.find(
      (row) => effectiveHours(row.report) > 0 && row.report.doneBy.length > 0,
    );
    expect(donor).toBeDefined();
    // A fresh copy of a real breakdown, moved onto an excluded machine with new report and ticket ids.
    const ticketId = 'a4-excluded-ticket';
    const reportId = 'a4-excluded-report';
    const ticket = {
      ...donor!.ticket,
      id: ticketId,
      ref: 'BD-A4-EXCLUDED',
      machineId: excluded.id,
      reportedAt: '2026-01-01T04:00:00.000Z',
      closedAt: '2026-01-01T05:00:00.000Z',
    };
    const report = {
      ...donor!.report,
      id: reportId,
      ticketId,
      machineId: excluded.id,
      date: '2026-01-01',
    };
    const grown: EngineData = {
      ...ENGINE_DATA,
      machines: [...ENGINE_DATA.machines, excluded],
      tickets: [...ENGINE_DATA.tickets, ticket],
      reports: [...ENGINE_DATA.reports, report],
    };
    const before = compute();
    const after = compute(grown);
    // Bhavin, 19 Nov: a machine left out of production data keeps its breakdowns in the manpower hours. The key's one
    // left-out machine has no breakdown, so the key cannot say otherwise; this row is the proof the filter is gone.
    const kpis = (figure: FigureResult) =>
      (figure.value as unknown as FigureKey).pages[0]!.kpis.map((entry) =>
        Number(entry.value.replaceAll(',', '')),
      );
    const [countBefore = NaN, hoursBefore = NaN] = kpis(before);
    const [countAfter = NaN, hoursAfter = NaN] = kpis(after);
    expect(countAfter).toBe(countBefore + 1);
    expect(Math.abs(hoursAfter - hoursBefore - effectiveHours(report))).toBeLessThan(0.1);
    expect(after.drill.ids).toEqual([...before.drill.ids, ticketId].sort());
    expect(before.value).toEqual(A4);
  });

  it('takes the team order from the settings: reversing it reverses the matrices but not the sorted table', () => {
    const teamCodes = SETTINGS.teamCodes ?? [];
    const names = new Map(ENGINE_DATA.people.map((person) => [person.code, person.displayName]));
    const reversedNames = [...teamCodes].reverse().map((code) => {
      const name = names.get(code);
      if (!name) throw new Error(`the fixture holds no person "${code}"`);
      return name;
    });
    const reversed: EngineData = {
      ...ENGINE_DATA,
      settings: { ...SETTINGS, teamCodes: [...teamCodes].reverse() },
    };
    const value = valueOf(reversed);
    expect(table(value, 'Specialization').rows.map((row) => row[0])).toEqual(reversedNames);
    expect(table(value, 'Month-on-Month — # Breakdowns Handled').rows.map((row) => row[0])).toEqual(
      reversedNames,
    );
    expect(table(value, 'Month-on-Month — BD Hours Handled').rows.map((row) => row[0])).toEqual(
      reversedNames,
    );
    // The Manpower table is sorted by done count desc, so the reversed settings cannot reorder it.
    const manpower = table(value, 'Manpower Table');
    expect(manpower.rows).toEqual(A4.pages[0]!.tables[0]!.rows);
    const counts = manpower.rows.map((row) => Number(row[2]));
    expect(counts).toEqual([...counts].sort((left, right) => right - left));
  });

  it('prints a configured category with no machines as an all-dash column, and nothing else changes', () => {
    const categories = SETTINGS.categories ?? [];
    const grown: EngineData = {
      ...ENGINE_DATA,
      settings: { ...SETTINGS, categories: [...categories, '5-Axis Router'] },
    };
    const value = valueOf(grown);
    const spec = table(value, 'Specialization');
    const keyed = table(A4, 'Specialization');
    // The Settings order places the new category last; no machine carries it, so every member prints the dash.
    expect(spec.header).toEqual([...keyed.header, '5-Axis Rout…']);
    expect(spec.rows).toEqual(keyed.rows.map((row) => [...row, '—']));
    // The fleet-derived list could not produce that column: the rest of the page is the key whole.
    const page = value.pages[0]!;
    const rest = {
      ...page,
      tables: page.tables.map((candidate) =>
        candidate.title === 'Specialization' ? keyed : candidate,
      ),
    };
    expect({ ...value, pages: [rest] }).toEqual(A4);
  });

  it('adds nothing for a Robot-category machine in the CNC segment, and a fully excluded category keeps its column', () => {
    const donor = CARRIED.find(
      (row) => effectiveHours(row.report) > 0 && row.report.doneBy.length > 0,
    )!;
    const base = ENGINE_DATA.machines.find((machine) => machine.id === donor.report.machineId)!;
    const clone = (id: string, category: string, excluded: boolean) => ({
      machine: { ...base, id, category, excludedFromProduction: excluded },
      ticket: { ...donor.ticket, id: `${id}-t`, ref: `BD-${id}`, machineId: id },
      report: { ...donor.report, id: `${id}-r`, ticketId: `${id}-t`, machineId: id },
    });
    const robot = clone('a4-robot', 'Robot', true);
    const lone = clone('a4-lone', 'Zeta Lathe', true);
    const withRows = (...added: ReturnType<typeof clone>[]): EngineData => ({
      ...ENGINE_DATA,
      // No configured list: the columns come from the machines A4 reads.
      settings: { ...SETTINGS, categories: undefined },
      machines: [...ENGINE_DATA.machines, ...added.map((entry) => entry.machine)],
      tickets: [...ENGINE_DATA.tickets, ...added.map((entry) => entry.ticket)],
      reports: [...ENGINE_DATA.reports, ...added.map((entry) => entry.report)],
    });
    const count = (value: FigureKey) => Number(value.pages[0]!.kpis[0]!.value.replaceAll(',', ''));
    const plain = valueOf(withRows());
    expect(count(valueOf(withRows(robot)))).toBe(count(plain));
    expect(table(valueOf(withRows(robot)), 'Specialization')).toEqual(
      table(plain, 'Specialization'),
    );
    const grown = valueOf(withRows(lone));
    expect(count(grown)).toBe(count(plain) + 1);
    const spec = table(grown, 'Specialization');
    expect(spec.header).toHaveLength(table(plain, 'Specialization').header.length + 1);
    expect(spec.header.at(-1)).toBe('Zeta Lathe');
    const done = new Map(
      table(grown, 'Manpower Table').rows.map((row) => [row[0], Number(row[2])]),
    );
    for (const row of spec.rows) {
      const cells = row
        .slice(1)
        .reduce((total, cell) => total + (cell === '—' ? 0 : Number(cell)), 0);
      expect(cells).toBe(done.get(row[0]) ?? 0);
    }
  });

  it('prints no page for an empty plant: no production breakdowns or no team', () => {
    const noTeam = compute({
      ...ENGINE_DATA,
      settings: { ...SETTINGS, teamCodes: [] },
    });
    expect(noTeam.status).toBe('ready');
    expect(noTeam.value).toBeNull();
    expect(noTeam.drill.ids).toEqual([]);
    const noReports = compute({ ...ENGINE_DATA, reports: [] });
    expect(noReports.status).toBe('ready');
    expect(noReports.value).toBeNull();
    expect(noReports.drill.ids).toEqual([]);
  });
});
