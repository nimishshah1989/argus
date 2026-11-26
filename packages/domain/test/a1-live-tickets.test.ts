import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS } from '../src/analytics/computers.js';
import { breakdownLog, isHistory, sourcedReports } from '../src/analytics/rows.js';
import type { EngineData } from '../src/index.js';
import { ENGINE_DATA } from './answer-key/fixture.js';
import { read } from './answer-key/keys.js';

/**
 * ADR 0064: a breakdown closed live in the app counts in A1 like a history row. The answer key's breakdown log holds 60
 * rows Bhavin's own app raised (`bd_live_`); here they are what they are in production, live tickets, and A1's November
 * must still be the key's. The one live row whose machine, date, shift and downtime equal a history row's
 * (`bd_live_mvux1lagiwcrh`, HMC-2, 30 Oct, 9 min, which the key counts twice) drops as the same breakdown.
 */

const AS_OF = '2026-11-11';
type Page = { tables: { title: string; rows: string[][] }[] };
const KEY = read<{ pages: Page[] }>('a1-bd-pm.json');

// The 60 in the CNC log, not the 7 `otherBD` rows the fixture already marks live (non-CNC, outside A1).
const liveIds = new Set(
  sourcedReports(ENGINE_DATA)
    .filter((row) => isHistory(row) && row.report.id.startsWith('bd_live_'))
    .map((row) => row.ticket.id),
);
const isLogLive = (id: string) => id.startsWith('bd_live_') && !OTHER.has(id);
const OTHER = new Set(
  sourcedReports(ENGINE_DATA)
    .filter((row) => !isHistory(row))
    .map((row) => row.report.id),
);
const LIVE: EngineData = {
  ...ENGINE_DATA,
  tickets: ENGINE_DATA.tickets.map((t) => (liveIds.has(t.id) ? { ...t, source: 'live' } : t)),
};

const plantRow = (page: Page, month: number): string => {
  const table = page.tables.find((t) => t.title.startsWith('Month-on-Month — BD % and PM %'))!;
  return table.rows.find((row) => row[0]!.startsWith('PLANT TOTAL'))![month]!;
};
const a1 = (data: EngineData): Page =>
  (
    COMPUTERS['a1-bd-pm']!({ data, asOf: AS_OF, profile: DEFAULT_PROFILE }).value as unknown as {
      pages: Page[];
    }
  ).pages[0]!;

describe('A1 counts live breakdowns (ADR 0064)', () => {
  it('the fixture really holds 60 live rows, 59 of them in November', () => {
    expect(liveIds.size).toBe(60);
    const november = sourcedReports(LIVE).filter(
      (row) => liveIds.has(row.ticket.id) && row.report.date.startsWith('2026-11'),
    );
    expect(november).toHaveLength(59);
  });

  it("November reads the key's 0.22% when those rows are live tickets", () => {
    expect(plantRow(KEY.pages[0]!, 11)).toBe('0.22%');
    expect(plantRow(a1(LIVE), 11)).toBe('0.22%');
  });

  it('the history-only rule it replaces read November short', () => {
    const historyOnly: EngineData = {
      ...LIVE,
      reports: LIVE.reports.filter((r) => !isLogLive(r.id)),
    };
    expect(plantRow(a1(historyOnly), 11)).toBe('0.00%');
  });

  it('a live report equal to a history row is the same breakdown and counts once', () => {
    const log = breakdownLog(LIVE).map((row) => row.report.id);
    expect(log).not.toContain('bd_live_mvux1lagiwcrh');
    expect(log.filter(isLogLive)).toHaveLength(59);
    // Both stay where both are history: the key's own rows, as Bhavin's platform kept them.
    expect(breakdownLog(ENGINE_DATA)).toHaveLength(sourcedReports(ENGINE_DATA).length);
  });
});
