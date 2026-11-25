import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import type { EngineData, ReportRow } from '../../src/index.js';
import { isPm, sourcedReports } from '../../src/analytics/rows.js';
import { failureEvents, standardTotals } from '../../src/analytics/standard-kpis.js';
import { ENGINE_DATA } from '../answer-key/fixture.js';

/** Hidden edges for #703: a named span decides what counts, on both sides. */

const AS_OF = '2026-11-11';
const failure = failureEvents(ENGINE_DATA)[0]!.report;
const pm = sourcedReports(ENGINE_DATA).find(
  (row) => isPm(row) && row.ticket.status === 'closed',
)!.report;

const plus = (...rows: ReportRow[]): EngineData => ({
  ...ENGINE_DATA,
  reports: [...ENGINE_DATA.reports, ...rows],
});
const at = (row: ReportRow, date: string, tag: string): ReportRow => ({
  ...row,
  id: `${row.id}-${tag}`,
  date,
});

describe('Shift KPIs span: edges', () => {
  it('a named span that starts in 2025 counts the 2025 failure', () => {
    const period = { from: '2025-01-01', to: AS_OF };
    const base = standardTotals({ ...ENGINE_DATA, period }, DEFAULT_PROFILE, AS_OF);
    const data = { ...plus(at(failure, '2025-06-02', 'y25')), period };
    expect(standardTotals(data, DEFAULT_PROFILE, AS_OF).failures).toBe(base.failures + 1);
  });

  it('a row after the span’s end is out, even before the as-of date', () => {
    const period = { from: '2026-01-01', to: '2026-06-30' };
    const base = standardTotals({ ...ENGINE_DATA, period }, DEFAULT_PROFILE, AS_OF);
    const late = failureEvents(ENGINE_DATA).filter((event) => event.report.date > '2026-06-30');
    expect(late.length).toBeGreaterThan(0);
    const onlyEarly = {
      ...ENGINE_DATA,
      reports: ENGINE_DATA.reports.filter((row) => row.date <= '2026-06-30'),
      period,
    };
    expect(base.failures).toBe(standardTotals(onlyEarly, DEFAULT_PROFILE, AS_OF).failures);
  });

  it('a PM row from before the span adds no PM hours', () => {
    const base = standardTotals(ENGINE_DATA, DEFAULT_PROFILE, AS_OF);
    const data = plus(at(pm, '2025-03-03', 'pm25'));
    expect(standardTotals(data, DEFAULT_PROFILE, AS_OF).pmHours).toBeCloseTo(base.pmHours, 10);
  });
});
