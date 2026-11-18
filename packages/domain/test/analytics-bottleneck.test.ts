import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData, type FigureResult } from '../src/index.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { ENGINE_DATA, read, type FigureKey } from './answer-key/fixture.js';

/**
 * The A9 risk core (packet 42a): the platform's first four KPIs and its risk and capacity tables against the frozen
 * 11 November key — whole objects and never a tolerance. Packets 42b and 42c own the other KPIs, tables and charts,
 * so this file reads only its own slices. The drill count is derived from the workbook, so a hard-coded page cannot
 * pass.
 *
 * The key is read here rather than exported from `keys.ts`: 42a to 42d share it, and the typed export belongs with
 * the packet that completes the page.
 */

const AS_OF = '2026-11-11';
const A9 = read<FigureKey>('a9-bottleneck-forecast.json');
/** The production fleet: CNC machines the plant counts in production data. */
const PRODUCTION = ENGINE_DATA.machines.filter(isProduction);

function compute(data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === 'a9-bottleneck-forecast');
  if (!found) throw new Error('the engine knows no figure a9-bottleneck-forecast');
  return found;
}

function pageOf(data: EngineData = ENGINE_DATA): FigureKey['pages'][number] {
  const value = compute(data).value as unknown as FigureKey | null;
  const page = value?.pages[0];
  if (!page) throw new Error('the A9 figure printed no page');
  return page;
}

describe('the A9 risk core', () => {
  it("equals the key's first four KPIs, the risk table and both capacity tables", () => {
    const computed = compute();
    // Red first: the A9 computer had not landed, so the engine answered not_computed.
    expect(computed.status).toBe('ready');
    const page = pageOf();
    const key = A9.pages[0]!;
    expect(page.kpis.slice(0, 4)).toEqual(key.kpis.slice(0, 4));
    expect(page.tables[0]).toEqual(key.tables[0]);
    expect(page.tables[3]).toEqual(key.tables[3]);
    expect(page.tables[4]).toEqual(key.tables[4]);
  });

  it('drills every production machine, derived from the workbook', () => {
    const computed = compute();
    expect(PRODUCTION.length).toBeGreaterThan(0);
    expect(computed.drill.type).toBe('machine');
    // The engine sorts and dedupes what the computer names: every production id, once.
    expect(computed.drill.ids).toEqual(PRODUCTION.map((machine) => machine.id).sort());
    const known = new Set(ENGINE_DATA.machines.map((machine) => machine.id));
    expect(computed.drill.ids.every((id) => known.has(id))).toBe(true);
  });

  it('reads no row of a machine the plant leaves out of production data', () => {
    const excluded = ENGINE_DATA.machines.find((machine) => machine.excludedFromProduction);
    if (excluded === undefined)
      throw new Error('the fixture excludes no machine from production data');
    const donor = ENGINE_DATA.reports.find(
      (report) => report.machineId !== excluded.id && report.maintCode !== 'PM',
    );
    if (donor === undefined) throw new Error('the fixture has no breakdown to move');
    const ticketId = 'a9-excluded-ticket';
    // A fresh copy of a real breakdown on an excluded machine: the risk core must not see it.
    const ticket = {
      ...ENGINE_DATA.tickets[0]!,
      id: ticketId,
      ref: 'BD-A9-EXCLUDED',
      machineId: excluded.id,
      reportedAt: '2026-01-01T04:00:00.000Z',
    };
    const report = {
      ...donor,
      id: 'a9-excluded-report',
      ticketId,
      machineId: excluded.id,
      date: '2026-01-01',
      recordedHours: 500,
    };
    const before = compute();
    expect(before.status).toBe('ready');
    const after = compute({
      ...ENGINE_DATA,
      tickets: [...ENGINE_DATA.tickets, ticket],
      reports: [...ENGINE_DATA.reports, report],
    });
    expect(after.value).toEqual(before.value);
    expect(after.drill.ids).toEqual(before.drill.ids);
  });
});
