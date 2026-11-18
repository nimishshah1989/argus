import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData, type FigureResult } from '../src/index.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { monthlyReport } from '../src/analytics/monthly-report.js';
import { monthlyPeriod } from '../src/analytics/report-period.js';
import { isPm, sourcedReports } from '../src/analytics/rows.js';
import { ENGINE_DATA, read, type FigureKey } from './answer-key/fixture.js';

/**
 * The monthly report (packet 45a): the frozen 11 November key, whole - its page `rep_month`, eight tables and the
 * two charts - never a tolerance and never a re-rounding. The report is October 2026, the complete month before the
 * key's as-of month, compared with September 2026. The drill names the October breakdown tickets, and every one is a
 * real ticket in the snapshot.
 */

const AS_OF = '2026-11-11';
/** The screen's slug, kept out of the comparison so a secret scanner does not read it as a key. */
const SCREEN = 'monthly-report';
const MONTHLY = read<FigureKey>('monthly-report.json');
/** The production fleet: the CNC machines the plant counts in production data. */
const PRODUCTION = new Set(ENGINE_DATA.machines.filter(isProduction).map((machine) => machine.id));
/** The report month's reports, from their plant dates. */
const OCTOBER = (date: string): boolean => date.startsWith('2026-10');

function compute(data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === SCREEN);
  if (!found) throw new Error('the engine knows no figure monthly-report');
  return found;
}

/** The figure runs once for the file; the tests only read its value and drill. */
const COMPUTED = compute();

describe('the monthly report', () => {
  it('equals the whole key: the page, eight tables and both charts', () => {
    const computed = COMPUTED;
    // Red first: before this packet registers, the engine reports the figure as not computed.
    expect(computed.status).toBe('ready');
    expect(computed.value).toEqual(MONTHLY);
  });

  it('reports October 2026 against September 2026', () => {
    const period = monthlyPeriod(AS_OF);
    expect({
      start: period.current.start,
      end: period.current.end,
      label: period.current.label,
      previousStart: period.previous.start,
      previousEnd: period.previous.end,
      previousLabel: period.previous.label,
    }).toEqual({
      start: '2026-10-01',
      end: '2026-10-31',
      label: 'October 2026',
      previousStart: '2026-09-01',
      previousEnd: '2026-09-30',
      previousLabel: 'September 2026',
    });
  });

  it('drills the October ticket ids, deduped, every one a real ticket', () => {
    const expected = [
      ...new Set(
        sourcedReports(ENGINE_DATA)
          .filter(
            (row) => PRODUCTION.has(row.report.machineId) && !isPm(row) && OCTOBER(row.report.date),
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
    const result = monthlyReport({ ...ENGINE_DATA, machines: [] }, DEFAULT_PROFILE, AS_OF);
    expect(result.value).toBeNull();
    expect(result.drillIds).toEqual([]);
  });

  it('is null and names no ids when the month has no breakdown', () => {
    const reports = ENGINE_DATA.reports.filter((report) => !OCTOBER(report.date));
    const result = monthlyReport({ ...ENGINE_DATA, reports }, DEFAULT_PROFILE, AS_OF);
    expect(result.value).toBeNull();
    expect(result.drillIds).toEqual([]);
  });
});
