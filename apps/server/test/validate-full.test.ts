/**
 * Ticket 79 (D34): `pnpm validate:full` on a small invented plant (three years, 13 tickets, no real data). It passes
 * on a clean database and fails, naming the figure or the ticket ref and nothing else, when a ticket is read by no
 * figure, when a drill is one row short, or when a second run gives another answer.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FIGURES, run } from '@uptimo/domain';
import { assertLocalUrl, connect } from '../src/seed/legacy-load.js';
import { validate, type Engine } from '../../../tools/validate-full.js';
import { parseAllowlist } from '../../../tools/validate-checks.js';
import { startTestDb, type TestDb } from './harness.js';

const T = '70000000-0000-0000-0000-000000000001';
const M1 = '70000000-0000-0000-0000-000000000101';
const M2 = '70000000-0000-0000-0000-000000000102';
const TILE = 'dashboard.total-breakdowns';
const AS_OF = '2024-12-31';
let db: TestDb;
const tenant = { id: T, timeZone: 'Asia/Kolkata' };

async function ticket(
  ref: string,
  machine: string,
  day: string,
  work: { minutes: number | null; code?: string },
) {
  const row = await db.admin.query(
    `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, raised_channel, severity)
     VALUES ($1, $2, $3, 'closed', $4, 'Invented fault', $5, $5, 'backfill', 'S3') RETURNING id`,
    [T, ref, work.minutes === null ? 'general' : 'stopped', machine, `${day}T04:00:00Z`],
  );
  if (work.minutes === null) return;
  await db.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, breakdown_category, maint_code)
     VALUES ($1, $2, $3, $4, 'DAY', 'Invented fault', $5, 'M', $6)`,
    [T, row.rows[0].id, machine, day, work.minutes, work.code ?? null],
  );
}

beforeAll(async () => {
  db = await startTestDb();
  const q = (text: string, params: unknown[]) => db.admin.query(text, params);
  await q("INSERT INTO tenant (id, slug, name) VALUES ($1, 'vf-plant', 'Validation plant')", [T]);
  await q("INSERT INTO segment (tenant_id, code, name) VALUES ($1, 'CNC', 'CNC')", [T]);
  for (const [id, code] of [
    [M1, 'VF-01'],
    [M2, 'VF-02'],
  ]) {
    await q(
      "INSERT INTO machine (id, tenant_id, code, segment_id, cell) SELECT $1, $2, $3, id, 'Cell-1' FROM segment WHERE tenant_id = $2",
      [id, T, code],
    );
  }
  await q(
    "INSERT INTO shift (tenant_id, code, name, starts_at, ends_at) VALUES ($1, 'DAY', 'Day', '08:00', '18:30')",
    [T],
  );
  for (const [at, year] of [2022, 2023, 2024].entries()) {
    await ticket(`VF-${at}1`, M1, `${year}-03-10`, { minutes: 60 });
    await ticket(`VF-${at}2`, M2, `${year}-06-02`, { minutes: 90 });
    await ticket(`VF-${at}3`, M1, `${year}-09-15`, { minutes: 30 });
    await ticket(`VF-${at}4`, M2, `${year}-11-20`, { minutes: 120 });
  }
  await ticket('VF-PM1', M1, '2023-04-04', { minutes: 45, code: 'PM' });
}, 240_000);

afterAll(async () => db?.stop());

describe('validate:full on a small invented plant', () => {
  it('passes on a clean database, with every figure, every year and every ticket accounted for', async () => {
    const report = await validate(db.app, tenant, { asOf: AS_OF });
    expect(report.unexplained).toEqual([]);
    expect(report.lines).toContain('0 unexplained differences');
    expect(report.lines.some((line) => line.startsWith('coverage: 13 of 13 tickets'))).toBe(true);
    for (const figure of FIGURES) {
      expect(report.lines.some((line) => line.startsWith(figure.key))).toBe(true);
    }
    expect(report.lines.filter((line) => line.startsWith('run ')).length).toBe(4);
    expect(report.lines.join('\n')).not.toMatch(/Invented|Validation plant/);
  }, 120_000);

  it('fails and names the ticket ref when a ticket is read by no figure, until a cause is listed', async () => {
    await ticket('VF-LONE', M1, '2023-07-07', { minutes: null });
    try {
      const report = await validate(db.app, tenant, { asOf: AS_OF });
      expect(report.unexplained.map((diff) => diff.id)).toEqual(['coverage:VF-LONE']);
      expect(report.lines.some((line) => line.includes('1 unread'))).toBe(true);
      const listed = await validate(db.app, tenant, {
        asOf: AS_OF,
        allowlist: '# explained\n- coverage:VF-LONE - an invented plant event no figure reads\n',
      });
      expect(listed.unexplained).toEqual([]);
      expect(listed.explained.map((diff) => diff.id)).toEqual(['coverage:VF-LONE']);
    } finally {
      await db.admin.query("DELETE FROM ticket WHERE tenant_id = $1 AND ref = 'VF-LONE'", [T]);
    }
  }, 120_000);

  it('fails when a figure drills to one row fewer than its number counts', async () => {
    const short: Engine = (...args) => {
      const result = run(...args);
      const tile = result.figures.find((figure) => figure.key === TILE)!;
      tile.drill.ids = tile.drill.ids.slice(1);
      return result;
    };
    const report = await validate(db.app, tenant, { asOf: AS_OF, engine: short });
    const ids = report.unexplained.map((diff) => diff.id);
    expect(ids).toContain(`drill:whole:${TILE}`);
    expect(report.lines.some((line) => /unexplained differences:/.test(line))).toBe(true);
  }, 120_000);

  it('fails when a second run gives another answer', async () => {
    let calls = 0;
    const drifting: Engine = (...args) => {
      const result = run(...args);
      calls += 1;
      if (calls > 4) {
        const tile = result.figures.find((figure) => figure.key === 'dashboard.pm-hours')!;
        tile.value = Number(tile.value) + 1;
      }
      return result;
    };
    const report = await validate(db.app, tenant, { asOf: AS_OF, engine: drifting });
    expect(report.unexplained.map((diff) => diff.id)).toContain('stable:whole:dashboard.pm-hours');
  }, 120_000);

  it('refuses a remote host and a superuser login before it reads anything', async () => {
    await expect(
      connect('postgres://app_api@db.example.com:5432/argus', 'vf-plant'),
    ).rejects.toThrow(/remote host/);
    await expect(
      connect('postgres://app_api:x@localhost:5432/argus?host=remote.example', 'vf-plant'),
    ).rejects.toThrow(/remote host/);
    await expect(connect(db.container.getConnectionUri(), 'vf-plant')).rejects.toThrow(
      /app_api role without superuser/,
    );
  });

  it('decides the host the way the pg driver does: empty and repeated values, hostaddr ignored', () => {
    const remote = [
      'postgres://u@evil.com/db?host=',
      'postgres://u@evil.com/db?hostaddr=',
      'postgres://u@evil.com/db?hostaddr=127.0.0.1',
      'postgres://u@evil.com/db?hostaddr=%3A%3A1',
      'postgres://u@localhost/db?host=localhost&host=evil.com',
      'postgres://u@localhost/db?host=a.example,localhost',
      'postgres://u@localhost.evil.com/db',
    ];
    for (const url of remote) expect(() => assertLocalUrl(url, false), url).toThrow(/remote host/);
    const local = [
      'postgres://u@localhost/db',
      'postgres://u@127.0.0.1:5433/db',
      'postgres://u@[::1]/db',
      'postgres://u@localhost/db?host=/var/run/postgresql',
      'postgres://u@evil.com/db?host=%2Fvar%2Frun%2Fpostgresql',
    ];
    for (const url of local) expect(() => assertLocalUrl(url, false), url).not.toThrow();
    expect(() => assertLocalUrl('postgres://u@evil.com/db', true)).not.toThrow();
  });

  it('accepts only an allowlist id that names whole segments before its star', () => {
    expect(parseAllowlist('- coverage:* - a cause').map((a) => a.id)).toEqual(['coverage:*']);
    for (const id of ['*', 'cov*', 'coverage:WR*', ':*']) {
      expect(() => parseAllowlist(`- ${id} - a cause`)).toThrow(/whole segments/);
    }
  });

  it('with an earlier run date, does not call a later ticket unread', async () => {
    const report = await validate(db.app, tenant, { asOf: '2023-06-30' });
    expect(report.unexplained).toEqual([]);
    expect(report.lines.some((line) => line.startsWith('coverage: 7 of 7 tickets'))).toBe(true);
    expect(
      report.lines.some((line) =>
        line.startsWith('database: 13 tickets (7 reported on or before 2023-06-30)'),
      ),
    ).toBe(true);
  }, 120_000);
});
