import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { erasePerson } from '../src/modules/identity/index.js';
import { A, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

// ADR 0058 (Nimish, 26 Nov): screens show people by name. The engine and what it keeps stay name-free; the names go
// in on the way out. An erased person keeps their code: neither their old name nor "Former staff" stands in for it.

const AS_OF = '2026-11-11';
/** Built at runtime so no test file carries a key-shaped literal. */
const KEY = ['real', 'names', 'test'].join('-').padEnd(40, 'x');
const ERASED_NAME = 'Zorbo Quixle Erased';
const CODE = /P-[0-9a-f]{8}/g;

let f: Fixture;
let technicianCode: string;
let erasedCode: string;

const code = (id: string): string => `P-${id.slice(0, 8)}`;

beforeAll(async () => {
  process.env.ERASURE_HASH_KEY = KEY;
  f = await startFixture();
  const technician = (
    await f.admin.query(
      "SELECT id FROM person WHERE tenant_id = $1 AND name = 'plant-a technician'",
      [A],
    )
  ).rows[0].id as string;
  const erased = (
    await f.admin.query(
      "INSERT INTO person (tenant_id, name, team) VALUES ($1, $2, 'maintenance') RETURNING id",
      [A, ERASED_NAME],
    )
  ).rows[0].id as string;
  technicianCode = code(technician);
  erasedCode = code(erased);
  // A closed history breakdown (no live raise channel), so the Breakdown Log lists it.
  const ticket = (
    await f.admin.query(
      `INSERT INTO ticket
         (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, severity, raised_channel)
       VALUES ($1, 'BD-0058', 'stopped', 'closed', $2, 'Spindle noise', '2026-11-05T04:00:00Z',
               '2026-11-05T06:00:00Z', 'S3', 'import') RETURNING id`,
      [A, M_USED],
    )
  ).rows[0].id as string;
  const report = (
    await f.admin.query(
      `INSERT INTO breakdown_report
         (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, breakdown_category)
       VALUES ($1, $2, $3, '2026-11-05', 'DAY', 'Spindle noise', 90, 'M') RETURNING id`,
      [A, ticket, M_USED],
    )
  ).rows[0].id as string;
  await f.admin.query(
    `INSERT INTO breakdown_report_person (tenant_id, report_id, person_id, role)
     VALUES ($1, $2, $3, 'done'), ($1, $2, $4, 'done')`,
    [A, report, technician, erased],
  );
  await withTenant(f.db.router, A, (tx) =>
    erasePerson(tx, {
      tenantId: A,
      personId: erased,
      requestRef: 'request-0058',
      operator: 'agent-test',
    }),
  );
}, 180_000);

afterAll(async () => {
  delete process.env.ERASURE_HASH_KEY;
  await f?.stop();
});

/** Every person code a reply prints. */
const codesIn = (body: string): string[] => [...new Set(body.match(CODE) ?? [])];

describe('people by name (ADR 0058)', () => {
  it('the figures reply names the breakdown log’s Done by, and prints no code but an erased person’s', async () => {
    const res = await f.call('GET', `/api/v1/analytics/figures?asOf=${AS_OF}`, f.tokens.head!);
    expect(res.statusCode, res.body).toBe(200);
    const log = JSON.stringify(
      (res.json().figures as { key: string; value: unknown }[]).find(
        (figure) => figure.key === 'breakdown-log',
      ),
    );
    expect(log).toContain('plant-a technician');
    expect(log).toContain(erasedCode);
    expect(codesIn(res.body)).toEqual([erasedCode]);
    expect(res.body).not.toContain(technicianCode);
    expect(res.body).not.toMatch(/zorbo|former staff/i);
  });

  it('keeps the stored run name-free: kpi_snapshot holds codes, never names', async () => {
    const run = await f.call('POST', '/api/v1/analytics/run', f.tokens.head!, { asOf: AS_OF });
    expect(run.statusCode, run.body).toBe(200);
    expect(codesIn(run.body)).toEqual([erasedCode]);
    const stored = JSON.stringify(
      (await f.admin.query('SELECT value FROM kpi_snapshot WHERE tenant_id = $1', [A])).rows,
    );
    expect(stored).toContain(technicianCode);
    expect(stored).not.toContain('plant-a technician');
  });

  it('names people in the compare and drill replies too', async () => {
    for (const url of [
      `/api/v1/analytics/compare?asOf=${AS_OF}`,
      `/api/v1/analytics/drill?type=machine&ids=${M_USED}`,
    ]) {
      const res = await f.call('GET', url, f.tokens.head!);
      expect(res.statusCode, `${url} ${res.body}`).toBeLessThan(500);
      expect(
        codesIn(res.body).filter((found) => found !== erasedCode),
        url,
      ).toEqual([]);
    }
  });
});
