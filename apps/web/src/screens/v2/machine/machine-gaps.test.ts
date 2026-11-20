// @vitest-environment node
import { describe, expect, it } from 'vitest';
import i18n from 'i18next';
import type { Ticket } from '@uptimo/shared/replies';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';
import '../../../i18n/index.js';
import { realReply } from '../figures/real-reply.js';
import { machinePageModel, type MachineFacts } from './adapter.js';

/**
 * v1's Machine page edge cases (the running-load tile, a machine with too little history, a machine the figure does not
 * hold, an uncomputed figure, the moves table's date column), ported from `register-screens.test.ts` and the reliability
 * e2e to the v2 adapter, against the engine's real reply.
 */
const t = (key: string, values?: Record<string, string | number>) =>
  i18n.t(key, { ...values }) as string;
const reply = realReply();
const machines = ENGINE_DATA.machines.map((m) => ({
  id: m.id,
  code: m.code,
  category: m.category ?? null,
  cell: m.cell ?? null,
}));
const facts = (param: string, tickets: Ticket[] | null = []): MachineFacts => ({
  param,
  machines,
  tickets,
  timeZone: 'Asia/Kolkata',
});

describe('what v1 said when the engine held less', () => {
  const withRecord = (entry: unknown): typeof reply => ({
    ...reply,
    figures: reply.figures.map((f) =>
      f.key === 'machine-page' ? { ...f, value: { byMachine: { m1: entry } } } : f,
    ),
  });
  const one = (entry: unknown) =>
    machinePageModel(withRecord(entry), { ...facts('m1'), machines: [] }, t)!;
  const FULL = {
    machine: { code: 'VC-1', category: 'Vertical Machining Center', powerKva: 21 },
    efficiencyPct: 20,
    breakdowns: { count: 3, hours: 4.5, mttr: 1.5 },
    pm: { visits: 1, hours: 2 },
    completeness: { recorded: 10, of: 10, missing: [] },
  };
  const load = (m: ReturnType<typeof one>) => m.kpis.find((k) => k.id === 'running-load')!;

  it('says the efficiency factor when the engine gave one, "Not available" once when there is no load', () => {
    expect(load(one(FULL)).meaning).toBe('20% efficiency factor');
    const none = load(one({ machine: { code: 'VC-1' }, breakdowns: { count: 0 } }));
    expect([none.value, none.meaning]).toEqual(['—', 'Not available']);
  });

  it('says "Not available" as the efficiency line when the load is known but its factor is not', () => {
    const half = load(one({ ...FULL, efficiencyPct: undefined, runningKva: 4.2 }));
    expect([half.value, half.meaning]).toEqual(['4.20 KVA', 'Not available']);
  });

  it('a machine the reliability figure does not hold says "Not available"; an uncomputed figure says so', () => {
    const missing = one(FULL);
    expect(missing.reliability.note).toBe('Not available');
    expect(missing.spares.note).toBe('Not available');
    const held = machinePageModel(
      {
        ...withRecord(FULL),
        figures: withRecord(FULL).figures.map((f) =>
          f.key === 'reliability' ? { ...f, status: 'not_computed' as const, value: null } : f,
        ),
      },
      { ...facts('m1'), machines: [] },
      t,
    )!;
    expect(held.reliability.note).toBe('Not computed yet');
    expect(held.spares.note).toBe('Not computed yet');
  });

  it('too little history prints both counts; a machine with no spare says so', () => {
    const own = reply.figures.find((f) => f.key === 'reliability')!;
    const thin = {
      ...reply,
      figures: reply.figures.map((f) =>
        f.key === 'reliability'
          ? {
              ...own,
              value: {
                machines: {
                  'HMC-2': {
                    fit: {
                      status: 'insufficient',
                      ownEvents: 4,
                      category: 'Turning Center',
                      categoryEvents: 3,
                      minimum: 5,
                    },
                    spares: { rows: [], total: 0 },
                    drill: { fit: [], spares: [] },
                  },
                },
              },
            }
          : f,
      ),
    };
    const page = machinePageModel(thin, facts('HMC-2'), t)!;
    expect(page.reliability.fit!.heading).toBe('Not enough history');
    expect(page.reliability.fit!.lines).toEqual([
      '4 failures on this machine, 3 in Turning Center; the fit needs 5.',
    ]);
    expect(page.spares.note).toBe('No spare was recorded on this machine’s breakdowns.');
    expect(page.spares.drill).toBeUndefined();
  });

  it('the moves table sorts as a date, across months and years, not as the words of the day', () => {
    const moves = ['2027-01-05', '2026-12-28', '2026-08-03', '2025-12-31'].map((date, at) => ({
      id: `m${at}`,
      machineId: 'm1',
      date,
      fromCell: '1',
      toCell: '2',
      fromLocation: null,
      toLocation: null,
    }));
    const table = one({ ...FULL, moves }).moves.table!;
    const sorted = [...table.rows].sort((a, b) =>
      String(a[0]!.sort).localeCompare(String(b[0]!.sort)),
    );
    expect(sorted.map((row) => row[0]!.text)).toEqual([
      '31-Dec-2025',
      '03-Aug-2026',
      '28-Dec-2026',
      '05-Jan-2027',
    ]);
  });
});
