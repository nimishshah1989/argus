import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FIGURES } from '@uptimo/domain';
import { withTenant } from '../src/kernel/index.js';
import { loadEngineData } from '../src/modules/analytics/load.js';
import { runForTenant } from '../src/modules/analytics/service.js';
import { STAMPED_TABLES } from '../src/modules/analytics/served.js';
import { A, M_FREE, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

// Ticket 75a: a figures read serves the stored run. The engine's `run` is wrapped so the test can count how often
// a read really computed; everything else in the domain package is the real thing.
const runCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock('@uptimo/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uptimo/domain')>();
  return {
    ...actual,
    run: (...args: Parameters<typeof actual.run>) => {
      runCalls.n += 1;
      return actual.run(...args);
    },
  };
});

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
  await f.admin.query(
    `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, raised_channel, severity)
     VALUES ($1, 'BD-7501', 'stopped', 'closed', $2, 'Spindle noise', '2026-11-01T04:00:00Z', '2026-11-01T06:00:00Z', 'floor', 'S3')`,
    [A, M_USED],
  );
  await f.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, breakdown_category)
     SELECT $1, id, $2, '2026-11-01', 'DAY', 'Spindle noise', 90, 'M' FROM ticket WHERE ref = 'BD-7501'`,
    [A, M_USED],
  );
}, 180_000);
afterAll(async () => f.stop());

const ASOF = '2026-11-12';
const figures = async (token = f.tokens.head!, asOf = ASOF) => {
  const res = await f.call('GET', `/api/v1/analytics/figures?asOf=${asOf}`, token);
  expect(res.statusCode).toBe(200);
  return res.json() as { figures: unknown[]; rows: Record<string, number>; profile: unknown };
};
const computes = async <T>(read: () => Promise<T>) => {
  const before = runCalls.n;
  const answer = await read();
  return { answer, ran: runCalls.n - before };
};
/** What the engine says right now, computed from the tables with no store in between. */
const fresh = async (asOf = ASOF) => {
  const result = await withTenant(f.db.app, A, (tx) => runForTenant(tx, { tenantId: A, asOf }));
  return JSON.parse(JSON.stringify(result)) as { figures: unknown[]; rows: Record<string, number> };
};

describe('figures served from the stored run (75a)', () => {
  it('computes once when nothing is stored, then serves the same figures without computing', async () => {
    const first = await computes(() => figures());
    expect(first.ran).toBe(1);
    const second = await computes(() => figures());
    expect(second.ran).toBe(0);
    expect(second.answer).toEqual(first.answer);
    const expected = await fresh();
    expect(second.answer.figures).toEqual(expected.figures);
    expect(second.answer.rows).toEqual(expected.rows);
  });

  it('serves another role from the same stored run, with the money figures still left out for it', async () => {
    await figures();
    const supervisor = await computes(() => figures(f.tokens.supervisor!));
    expect(supervisor.ran).toBe(0);
    const money = new Set(FIGURES.filter((figure) => figure.money).map((figure) => figure.key));
    const keys = (supervisor.answer.figures as { key: string }[]).map((figure) => figure.key);
    expect(keys.length).toBeGreaterThan(30);
    expect(keys.filter((key) => money.has(key))).toEqual([]);
  });

  it('computes one run, not one per reader, when many read a stale day at once', async () => {
    const day = '2026-11-13';
    const burst = await computes(() =>
      Promise.all(Array.from({ length: 12 }, () => figures(f.tokens.head!, day))),
    );
    expect(burst.ran).toBe(1);
    const answers = burst.answer as unknown[];
    for (const answer of answers) expect(answer).toEqual(answers[0]);
  });

  const changes: Array<[string, () => Promise<unknown>]> = [
    [
      'a ticket is closed',
      () =>
        f.admin.query(
          `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, raised_channel, severity)
           VALUES ($1, 'BD-7502', 'stopped', 'closed', $2, 'Belt snapped', '2026-11-05T04:00:00Z', '2026-11-05T09:00:00Z', 'floor', 'S3')`,
          [A, M_USED],
        ),
    ],
    [
      'a breakdown report is edited',
      () =>
        f.admin.query(
          "UPDATE breakdown_report SET downtime_min = 300 WHERE problem = 'Spindle noise'",
        ),
    ],
    [
      'a machine moves to another cell',
      () =>
        f.admin.query(
          `INSERT INTO machine_move (tenant_id, machine_id, from_cell, to_cell, effective_from)
           VALUES ($1, $2, 'Cell-1', 'Cell-9', '2026-11-03')`,
          [A, M_USED],
        ),
    ],
    [
      'a machine is left out of production data',
      () =>
        f.admin.query(
          `UPDATE machine SET metadata = metadata || '{"excludedFromProduction": true}'::jsonb WHERE id = $1`,
          [M_FREE],
        ),
    ],
  ];
  it.each(changes)('computes again, and only once, after %s', async (_name, change) => {
    await figures();
    expect((await computes(() => figures())).ran).toBe(0);
    const before = await figures();
    await change();
    const after = await computes(() => figures());
    expect(after.ran).toBe(1);
    expect(after.answer).not.toEqual(before);
    expect(after.answer.figures).toEqual((await fresh()).figures);
    expect((await computes(() => figures())).ran).toBe(0);
  });

  it('computes again after the plant changes its analytics profile', async () => {
    await figures();
    const list = await f.call('GET', '/api/v1/analytics-profile', f.tokens.head!);
    const row = list.json().items[0] as { id: string; mmThroughput: number };
    const put = await f.call('PUT', `/api/v1/analytics-profile/${row.id}`, f.tokens.head!, {
      mmThroughput: row.mmThroughput + 100,
    });
    expect(put.statusCode).toBe(200);
    const after = await computes(() => figures());
    expect(after.ran).toBe(1);
    expect((after.answer.profile as { mmThroughput: number }).mmThroughput).toBe(
      row.mmThroughput + 100,
    );
  });

  it('keeps another plant out of the stored run', async () => {
    await figures();
    const other = await computes(() => figures(f.tokens['b-admin']!));
    expect(other.ran).toBe(1);
    expect(other.answer.rows).toMatchObject({ machines: 1, tickets: 0 });
    expect((await figures()).rows).toMatchObject({ machines: 2 });
  });
});

describe('the stamp covers what the engine reads (75a)', () => {
  /** `ticket_event` moves `ticket.last_event_seq` on every append; `tenant_info` is read into the stamp as a function. */
  const COVERED_ELSEWHERE = new Set(['ticket_event', 'tenant_info']);

  it('stamps every table the plant loader queries', async () => {
    const queried = new Set<string>();
    await withTenant(f.db.app, A, async (tx) => {
      const spy = {
        query: ((text: string, values?: unknown[]) => {
          for (const match of text.matchAll(/\b(?:FROM|JOIN)\s+([a-z_]+)/gi))
            queried.add(match[1]!.toLowerCase());
          return tx.query(text, values);
        }) as typeof tx.query,
      };
      await loadEngineData(spy, A);
    });
    const stamped = new Set<string>(STAMPED_TABLES);
    const missing = [...queried].filter(
      (table) => !stamped.has(table) && !COVERED_ELSEWHERE.has(table),
    );
    expect(missing).toEqual([]);
    expect(queried.size).toBeGreaterThan(8);
  });
});
