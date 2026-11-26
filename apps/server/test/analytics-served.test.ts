import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FIGURES } from '@uptimo/domain';
import { withTenant } from '../src/kernel/index.js';
import { runForTenant } from '../src/modules/analytics/service.js';
import { nameCodes, personNames } from '../src/modules/identity/index.js';
import { servedRun, STAMPED_TABLES, warmServedRun } from '../src/modules/analytics/served.js';
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
/** The warm job's work (ticket 606): what brings a kept run up to date once the data moved. */
const warm = (asOf = ASOF) => warmServedRun(f.db.app, { tenantId: A, asOf });
const computes = async <T>(read: () => Promise<T>) => {
  const before = runCalls.n;
  const answer = await read();
  return { answer, ran: runCalls.n - before };
};
/** What the engine says right now, computed from the tables with no store in between, named as a reply is (ADR 0058). */
const fresh = async (asOf = ASOF) => {
  const result = await withTenant(f.db.app, A, async (tx) =>
    nameCodes(
      JSON.parse(JSON.stringify(await runForTenant(tx, { tenantId: A, asOf }))),
      await personNames(tx, A),
    ),
  );
  return result as { figures: unknown[]; rows: Record<string, number> };
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
  it.each(changes)(
    'serves the kept run after %s, and one warm run brings it up to date (606)',
    async (_name, change) => {
      await figures();
      await warm();
      expect((await computes(() => figures())).ran).toBe(0);
      const before = await figures();
      await change();
      const stale = await computes(() => figures());
      expect(stale.ran).toBe(0);
      expect(stale.answer).toEqual(before);
      expect((await computes(warm)).ran).toBe(1);
      const after = await computes(() => figures());
      expect(after.ran).toBe(0);
      expect(after.answer).not.toEqual(before);
      expect(after.answer.figures).toEqual((await fresh()).figures);
    },
  );

  it('serves the old profile after the plant changes it, until the warm run (606)', async () => {
    await figures();
    await warm();
    const list = await f.call('GET', '/api/v1/analytics-profile', f.tokens.head!);
    const row = list.json().items[0] as { id: string; mmThroughput: number };
    const put = await f.call('PUT', `/api/v1/analytics-profile/${row.id}`, f.tokens.head!, {
      mmThroughput: row.mmThroughput + 100,
    });
    expect(put.statusCode).toBe(200);
    const stale = await computes(() => figures());
    expect(stale.ran).toBe(0);
    expect((stale.answer.profile as { mmThroughput: number }).mmThroughput).toBe(row.mmThroughput);
    await warm();
    const after = await computes(() => figures());
    expect(after.ran).toBe(0);
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

/** The table names a SQL text reads: after FROM or JOIN, comma lists included, quotes and schema prefixes dropped. */
export function tablesOf(sql: string): string[] {
  const clause =
    /\b(?:FROM|JOIN)\s+([^()]*?)(?=\s+(?:WHERE|ON|ORDER|GROUP|LEFT|RIGHT|INNER|FULL|JOIN|LIMIT|FOR|UNION|USING)\b|\)|;|$)/gis;
  return [...sql.matchAll(clause)].flatMap((match) =>
    match[1]!
      .split(',')
      .map((part) => part.trim().split(/\s+/)[0]!.split('.').pop()!.replace(/"/g, '').toLowerCase())
      .filter((name) => /^[a-z_][a-z0-9_]*$/.test(name)),
  );
}

describe('the stamp covers what the engine reads (75a)', () => {
  /** `ticket_event` moves `ticket.last_event_seq` on every append; the loader reads only its why-why lines. */
  const COVERED_ELSEWHERE = new Set(['ticket_event']);

  it('reads table names out of comma lists, quotes and schema prefixes', () => {
    expect(tablesOf('SELECT 1 FROM a, public."b" x JOIN c ON c.id = x.id WHERE 1=1')).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('stamps every table a run reads: the loader and the profile read of the service', async () => {
    const queried = new Set<string>();
    await withTenant(f.db.app, A, async (tx) => {
      const spy = {
        query: ((text: string, values?: unknown[]) => {
          for (const table of tablesOf(text)) queried.add(table);
          return tx.query(text, values);
        }) as typeof tx.query,
      };
      await runForTenant(spy, { tenantId: A, asOf: ASOF });
    });
    const stamped = new Set<string>(STAMPED_TABLES);
    const missing = [...queried].filter(
      (table) => !stamped.has(table) && !COVERED_ELSEWHERE.has(table),
    );
    expect(missing).toEqual([]);
    expect(queried.size).toBeGreaterThan(8);
  });
});

describe('the stamp and the lock under concurrent writers (75a)', () => {
  it('the warm run sees a write that commits after a newer transaction already committed (606)', async () => {
    const day = '2026-11-14';
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, raised_channel, severity)
       VALUES ($1, 'BD-7503', 'stopped', 'open', $2, 'Belt', '2026-11-06T04:00:00Z', 'floor', 'S3')`,
      [A, M_USED],
    );
    await figures(f.tokens.head!, day);
    const early = await f.admin.connect();
    const late = await f.admin.connect();
    try {
      await early.query('BEGIN');
      await early.query('SELECT txid_current()');
      await late.query('BEGIN');
      await late.query("UPDATE ticket SET problem = 'Belt B' WHERE ref = 'BD-7501'");
      await late.query('COMMIT');
      // The read serves the kept run; the warm run sees the write that committed late (ticket 606).
      expect((await computes(() => figures(f.tokens.head!, day))).ran).toBe(0);
      expect((await computes(() => warm(day))).ran).toBe(1);
      expect((await computes(() => warm(day))).ran).toBe(0);
      await early.query("UPDATE ticket SET problem = 'Belt A' WHERE ref = 'BD-7503'");
      await early.query('COMMIT');
      expect((await computes(() => figures(f.tokens.head!, day))).ran).toBe(0);
      expect((await computes(() => warm(day))).ran).toBe(1);
    } finally {
      early.release();
      late.release();
    }
  });

  it('serves a waiter the run saved while it waited, even though a write landed meanwhile', async () => {
    const day = '2026-11-15';
    let started!: () => void;
    const leaderComputing = new Promise<void>((resolve) => (started = resolve));
    let release!: () => void;
    const leaderMayFinish = new Promise<void>((resolve) => (release = resolve));
    const leader = withTenant(f.db.app, A, (tx) =>
      servedRun(tx, {
        tenantId: A,
        asOf: day,
        compute: async () => {
          const result = await runForTenant(tx, { tenantId: A, asOf: day });
          started();
          await leaderMayFinish;
          return result;
        },
      }),
    );
    await leaderComputing;
    let waiterComputed = 0;
    const waiter = withTenant(f.db.app, A, (tx) =>
      servedRun(tx, {
        tenantId: A,
        asOf: day,
        compute: async () => {
          waiterComputed += 1;
          return runForTenant(tx, { tenantId: A, asOf: day });
        },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    await f.admin.query("UPDATE ticket SET problem = 'Belt C' WHERE ref = 'BD-7503'");
    release();
    const [first, second] = await Promise.all([leader, waiter]);
    expect(waiterComputed).toBe(0);
    expect(second).toEqual(first);
    expect((await computes(() => figures(f.tokens.head!, day))).ran).toBe(0);
    expect((await computes(() => warm(day))).ran).toBe(1);
  });

  it('writes one kept row for the date and no stored-figure row on a read', async () => {
    const day = '2026-11-16';
    const stored = "SELECT count(*)::int AS n FROM kpi_snapshot WHERE profile <> 'served'";
    const before = (await f.admin.query(stored)).rows[0].n;
    await figures(f.tokens.head!, day);
    const kept = (
      await f.admin.query(
        "SELECT key, subject_kind, as_of::text FROM kpi_snapshot WHERE profile = 'served' AND as_of = $1",
        [day],
      )
    ).rows;
    expect(kept).toEqual([{ key: 'figures-run', subject_kind: 'plant', as_of: day }]);
    expect((await f.admin.query(stored)).rows[0].n).toBe(before);
  });

  it('shows a supervisor no money figure even when that read is the one that computes and keeps the run', async () => {
    const day = '2026-11-17';
    const first = await computes(() => figures(f.tokens.supervisor!, day));
    expect(first.ran).toBe(1);
    const money = new Set(FIGURES.filter((figure) => figure.money).map((figure) => figure.key));
    const keys = (first.answer.figures as { key: string }[]).map((figure) => figure.key);
    expect(keys.filter((key) => money.has(key))).toEqual([]);
    const head = await figures(f.tokens.head!, day);
    expect((head.figures as { key: string }[]).some((figure) => money.has(figure.key))).toBe(true);
  });

  it('keeps at most eight dates per plant', async () => {
    for (let n = 0; n < 10; n += 1) await figures(f.tokens.head!, `2026-10-${String(10 + n)}`);
    const kept = await f.admin.query(
      "SELECT count(*)::int AS n FROM kpi_snapshot WHERE profile = 'served' AND tenant_id = $1",
      [A],
    );
    expect(kept.rows[0].n).toBe(8);
  });
});
