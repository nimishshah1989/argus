import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData, type FigureResult } from '../src/index.js';
import { annualPeriod, annualReport } from '../src/analytics/annual-report.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { isPm, sourcedReports } from '../src/analytics/rows.js';
import { ENGINE_DATA, read, type FigureKey } from './answer-key/fixture.js';

/**
 * The annual report (packet 45b): the frozen 11 November key, whole - its page `rep_year`, twelve tables and the
 * two charts - never a tolerance and never a re-rounding. The report is 1 January 2026 to the key's as-of date, so
 * November is partial and prints `(to date)`; 2025 has no data, so every comparison cell is a dash. The drill names
 * the year's breakdown tickets, and every one is a real ticket in the snapshot.
 */

const AS_OF = '2026-11-11';
/** The screen's slug, kept out of the comparison so a secret scanner does not read it as a key. */
const SCREEN = 'annual-report';
const ANNUAL = read<FigureKey>('annual-report.json');
/** The production fleet: the CNC machines the plant counts in production data. */
const PRODUCTION = new Set(ENGINE_DATA.machines.filter(isProduction).map((machine) => machine.id));
/** A plant date inside the report's year, both ends included. */
const IN_YEAR = (date: string): boolean => date >= '2026-01-01' && date <= AS_OF;

function compute(data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === SCREEN);
  if (!found) throw new Error('the engine knows no figure annual-report');
  return found;
}

/** The figure runs once for the file; the tests only read its value and drill. */
const COMPUTED = compute();

describe('the annual report', () => {
  it('equals the whole key: the page, twelve tables and both charts', () => {
    const computed = COMPUTED;
    // Red first: before this packet registers, the engine reports the figure as not computed.
    expect(computed.status).toBe('ready');
    expect(computed.value).toEqual(ANNUAL);
  });

  it('reports 1 January to 11 November 2026, November to date', () => {
    expect(annualPeriod(AS_OF)).toEqual({
      year: 2026,
      start: '2026-01-01',
      end: AS_OF,
      lastMonth: 11,
    });
  });

  it('drills the year ticket ids, deduped, every one a real ticket', () => {
    const expected = [
      ...new Set(
        sourcedReports(ENGINE_DATA)
          .filter(
            (row) => PRODUCTION.has(row.report.machineId) && !isPm(row) && IN_YEAR(row.report.date),
          )
          .map((row) => row.ticket.id),
      ),
    ].sort();
    expect(COMPUTED.drill.type).toBe('ticket');
    expect(COMPUTED.drill.ids).toEqual(expected);
    const tickets = new Set(ENGINE_DATA.tickets.map((ticket) => ticket.id));
    expect(COMPUTED.drill.ids.length).toBeGreaterThan(0);
    expect(COMPUTED.drill.ids.every((id) => tickets.has(id))).toBe(true);
  });

  it('is null and names no ids when the plant has no production machine', () => {
    const result = annualReport({ ...ENGINE_DATA, machines: [] }, DEFAULT_PROFILE, AS_OF);
    expect(result.value).toBeNull();
    expect(result.drillIds).toEqual([]);
  });

  it('is null and names no ids when the year has no breakdown', () => {
    const reports = ENGINE_DATA.reports.filter((report) => !IN_YEAR(report.date));
    const result = annualReport({ ...ENGINE_DATA, reports }, DEFAULT_PROFILE, AS_OF);
    expect(result.value).toBeNull();
    expect(result.drillIds).toEqual([]);
  });
});
