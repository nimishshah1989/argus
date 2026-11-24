import type { EngineData, ReportRow, TicketRow } from '../src/index.js';
import { ENGINE_DATA } from './answer-key/fixture.js';

/** Every 2026 date-time string in a row moved to `year`; 2026 is not a leap year, so every date stays a real one. */
function shifted<T extends object>(row: T, year: number): T {
  const out = { ...row } as Record<string, unknown>;
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === 'string' && value.startsWith('2026-'))
      out[key] = `${year}${value.slice(4)}`;
  }
  return out as T;
}

/**
 * ADR 0027: the 2026 answer-key plant with two older years of history beside it, as the 69 legacy load leaves it. Each
 * older year is the 2026 tickets and reports moved back to that year, with ids and refs prefixed so nothing collides.
 */
export function withHistory(data: EngineData, years: readonly number[]): EngineData {
  const old = years.flatMap((year) => {
    const id = (x: string) => `h${year}-${x}`;
    const tickets = data.tickets.map((t): TicketRow => ({
      ...shifted(t, year),
      id: id(t.id),
      ref: id(t.ref),
    }));
    const reports = data.reports.map((r): ReportRow => ({
      ...shifted(r, year),
      id: id(r.id),
      ticketId: r.ticketId === null ? null : id(r.ticketId),
    }));
    return [{ tickets, reports }];
  });
  return {
    ...data,
    tickets: [...old.flatMap((o) => o.tickets), ...data.tickets],
    reports: [...old.flatMap((o) => o.reports), ...data.reports],
  };
}

export const COSMOS_FROM = '2026-01-01';
export const HISTORY: EngineData = withHistory(ENGINE_DATA, [2024, 2022]);
export const withFrom = (data: EngineData, from: string): EngineData => ({
  ...data,
  settings: { excludedMachineIds: [], problemFixes: {}, ...data.settings, dataFrom: from },
});
