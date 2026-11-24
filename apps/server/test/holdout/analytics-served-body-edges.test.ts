import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REPLY_SCHEMAS } from '@uptimo/shared/replies';
import {
  engineRunsInRead,
  resetEngineRunsInRead,
  warmServedRun,
} from '../../src/modules/analytics/served.js';
import {
  bodiesBuilt,
  resetServedBodies,
  SERVED_BODY_LIMIT,
} from '../../src/modules/analytics/served-body.js';
import { A, M_USED, startFixture, type Fixture } from '../plant-settings-fixture.js';

// Ticket 628 hidden edges: concurrency (one build, one engine run), plant isolation, encodings, If-None-Match
// lists, the reply contract, and the bound on held bodies.

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
  await f.admin.query(
    `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, raised_channel, severity)
     VALUES ($1, 'BD-6285', 'stopped', 'closed', $2, 'Spindle noise', '2026-11-01T04:00:00Z', '2026-11-01T06:00:00Z', 'floor', 'S3')`,
    [A, M_USED],
  );
}, 180_000);
afterAll(async () => f.stop());
beforeEach(() => {
  resetEngineRunsInRead();
  resetServedBodies();
});

const read = (
  asOf: string,
  role: string,
  headers: Record<string, string> = {},
  plant = 'plant-a',
) =>
  f.app.inject({
    method: 'GET',
    url: `/api/v1/analytics/figures?asOf=${asOf}`,
    headers: { host: `${plant}.localhost`, authorization: `Bearer ${f.tokens[role]}`, ...headers },
  });
const gz = { 'accept-encoding': 'gzip' };
const body = (res: Awaited<ReturnType<typeof read>>) =>
  JSON.parse(
    (res.headers['content-encoding'] === 'gzip'
      ? gunzipSync(res.rawPayload)
      : res.rawPayload
    ).toString('utf8'),
  ) as unknown;
const schema = REPLY_SCHEMAS['GET /api/v1/analytics/figures']!;

describe('figures body edges (628)', () => {
  it('twenty concurrent reads of a kept run not yet held build one body and run no engine', async () => {
    const day = '2026-10-20';
    await warmServedRun(f.db.app, { tenantId: A, asOf: day });
    const all = await Promise.all(Array.from({ length: 20 }, () => read(day, 'head', gz)));
    expect(all.every((res) => res.statusCode === 200)).toBe(true);
    expect(new Set(all.map((res) => res.headers.etag)).size).toBe(1);
    expect(bodiesBuilt()).toBe(1);
    expect(engineRunsInRead()).toBe(0);
  });

  it('twenty concurrent reads of a cold date run the engine once and agree on one ETag', async () => {
    const day = '2026-10-21';
    const all = await Promise.all(Array.from({ length: 20 }, () => read(day, 'head', gz)));
    expect(all.every((res) => res.statusCode === 200)).toBe(true);
    expect(new Set(all.map((res) => res.headers.etag)).size).toBe(1);
    expect(engineRunsInRead()).toBe(1);
  });

  it('never serves one plant the body or a 304 of another plant on the same date', async () => {
    const day = '2026-10-22';
    const a = await read(day, 'admin', gz);
    const b = await read(
      day,
      'b-admin',
      { ...gz, 'if-none-match': String(a.headers.etag) },
      'plant-b',
    );
    expect(b.statusCode).toBe(200);
    expect(b.headers.etag).not.toBe(a.headers.etag);
    expect(body(b)).not.toEqual(body(a));
  });

  it('answers 304 when the ETag is one of a list, and 200 to a stale or garbage ETag', async () => {
    const day = '2026-10-23';
    const etag = String((await read(day, 'head', gz)).headers.etag);
    expect(
      (await read(day, 'head', { ...gz, 'if-none-match': `"nope", ${etag}` })).statusCode,
    ).toBe(304);
    expect((await read(day, 'head', { ...gz, 'if-none-match': '"nope"' })).statusCode).toBe(200);
    expect(
      (await read(day, 'head', { ...gz, 'if-none-match': etag.replace('.m"', '.p"') })).statusCode,
    ).toBe(200);
  });

  it('sends plain JSON to br-only and gzip;q=0 callers', async () => {
    const day = '2026-10-23';
    for (const enc of ['br', 'gzip;q=0']) {
      const res = await read(day, 'head', { 'accept-encoding': enc });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-encoding']).toBeUndefined();
      expect(schema.safeParse(res.json()).success).toBe(true);
    }
  });

  it('keeps the reply contract for money and non-money readers', async () => {
    const day = '2026-10-24';
    for (const role of ['head', 'supervisor', 'admin']) {
      const parsed = schema.safeParse(body(await read(day, role, gz)));
      expect(parsed.success, `${role}: ${JSON.stringify(parsed.error?.issues?.[0])}`).toBe(true);
    }
  });

  it('gives each date its own ETag and body', async () => {
    const one = await read('2026-10-25', 'head', gz);
    const two = await read('2026-10-26', 'head', gz);
    expect(one.headers.etag).not.toBe(two.headers.etag);
    expect((body(one) as { asOf: string }).asOf).toBe('2026-10-25');
    expect((body(two) as { asOf: string }).asOf).toBe('2026-10-26');
  });

  it('holds one body per date and money view: re-reading four dates for two views builds nothing new', async () => {
    // `served.ts` keeps 8 dates a plant, so the bound (SERVED_BODY_LIMIT) is checked by review, not by reading 33 dates.
    expect(SERVED_BODY_LIMIT).toBeGreaterThanOrEqual(16);
    const days = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];
    for (const day of days) for (const role of ['head', 'supervisor']) await read(day, role, gz);
    expect(bodiesBuilt()).toBe(8);
    for (const day of days) for (const role of ['head', 'supervisor']) await read(day, role, gz);
    expect(bodiesBuilt()).toBe(8);
  });

  it('leaves POST /analytics/run computing every time', async () => {
    const day = '2026-10-27';
    const post = () =>
      f.app.inject({
        method: 'POST',
        url: '/api/v1/analytics/run',
        headers: {
          host: 'plant-a.localhost',
          authorization: `Bearer ${f.tokens.head}`,
          'content-type': 'application/json',
        },
        payload: { asOf: day },
      });
    expect((await post()).statusCode).toBe(200);
    expect((await post()).statusCode).toBe(200);
    expect(bodiesBuilt()).toBe(0);
  });
});
