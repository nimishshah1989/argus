import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withTenant } from '../src/kernel/index.js';
import { runForTenant } from '../src/modules/analytics/service.js';
import {
  engineRunsInRead,
  FIGURES_WARM_QUEUE,
  resetEngineRunsInRead,
  warmServedRun,
} from '../src/modules/analytics/served.js';
import { bodiesBuilt, resetServedBodies } from '../src/modules/analytics/served-body.js';
import { A, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

// Ticket 628 (ADR 0029): a figures read sends a body built once per kept run, gzipped, with an ETag; a repeat read
// with that ETag gets 304. G3.2 (30 readers, p95 <= 300 ms) failed because every read re-read and re-serialised a
// 13 MB kept run (ticket 607).

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
  await f.admin.query(
    `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, raised_channel, severity)
     VALUES ($1, 'BD-6281', 'stopped', 'closed', $2, 'Spindle noise', '2026-11-01T04:00:00Z', '2026-11-01T06:00:00Z', 'floor', 'S3')`,
    [A, M_USED],
  );
}, 180_000);
afterAll(async () => f.stop());
beforeEach(() => {
  resetEngineRunsInRead();
  resetServedBodies();
});

type Reply = { figures: { key: string }[]; profile: Record<string, unknown> };
const read = (asOf: string, role: string, headers: Record<string, string> = {}) =>
  f.app.inject({
    method: 'GET',
    url: `/api/v1/analytics/figures?asOf=${asOf}`,
    headers: { host: 'plant-a.localhost', authorization: `Bearer ${f.tokens[role]}`, ...headers },
  });
const gz = { 'accept-encoding': 'gzip, deflate, br' };
const unzipped = (res: Awaited<ReturnType<typeof read>>) =>
  JSON.parse(gunzipSync(res.rawPayload).toString('utf8')) as Reply;
const fresh = async (asOf: string) =>
  JSON.parse(
    JSON.stringify(await withTenant(f.db.app, A, (tx) => runForTenant(tx, { tenantId: A, asOf }))),
  ) as Reply;
let n = 6290;
const write = () =>
  f.admin.query(
    `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, raised_channel, severity)
     VALUES ($1, $2, 'stopped', 'closed', $3, 'Belt snapped', '2026-11-05T04:00:00Z', '2026-11-05T09:00:00Z', 'floor', 'S3')`,
    [A, `BD-${(n += 1)}`, M_USED],
  );

describe('a figures read is cheap (628)', () => {
  it('sends the kept figures gzipped, with an ETag, private no-cache and vary', async () => {
    const day = '2026-11-12';
    const res = await read(day, 'head', gz);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.headers.etag).toMatch(/^"[0-9a-f-]{36}\.m"$/);
    expect(String(res.headers['cache-control'])).toMatch(/private/);
    expect(String(res.headers['cache-control'])).toMatch(/no-cache/);
    expect(String(res.headers.vary)).toMatch(/accept-encoding/i);
    expect(unzipped(res).figures).toEqual((await fresh(day)).figures);
  });

  it('sends the same JSON unzipped to a caller that does not accept gzip', async () => {
    const day = '2026-11-12';
    const zipped = unzipped(await read(day, 'head', gz));
    const plain = await read(day, 'head');
    expect(plain.statusCode).toBe(200);
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(plain.json()).toEqual(zipped);
  });

  it('answers 304 with no body to the ETag it sent, and builds the body once for ten reads', async () => {
    const day = '2026-11-13';
    const first = await read(day, 'head', gz);
    for (let i = 0; i < 9; i += 1) expect((await read(day, 'head', gz)).statusCode).toBe(200);
    expect(bodiesBuilt()).toBe(1);
    const again = await read(day, 'head', { ...gz, 'if-none-match': String(first.headers.etag) });
    expect(again.statusCode).toBe(304);
    expect(again.rawPayload.length).toBe(0);
    expect(again.headers.etag).toBe(first.headers.etag);
  });

  it('gives a supervisor its own body: money hidden, a different ETag, and no 304 on the head ETag', async () => {
    const day = '2026-11-13';
    const head = await read(day, 'head', gz);
    const sup = await read(day, 'supervisor', {
      ...gz,
      'if-none-match': String(head.headers.etag),
    });
    expect(sup.statusCode).toBe(200);
    expect(sup.headers.etag).toMatch(/\.p"$/);
    expect(sup.headers.etag).not.toBe(head.headers.etag);
    expect(unzipped(sup).figures.length).toBeLessThan(unzipped(head).figures.length);
    expect(unzipped(sup).figures.map((x) => x.key)).not.toContain('money-matters');
  });

  it('after a write keeps the ETag and queues a warm job; after the warm job a new ETag and the new figures', async () => {
    const day = '2026-11-14';
    const before = await read(day, 'head', gz);
    await write();
    const stale = await read(day, 'head', gz);
    expect(stale.headers.etag).toBe(before.headers.etag);
    const queued = await f.admin.query(
      `SELECT count(*)::int AS n FROM pgboss.job WHERE name = $1 AND data->>'tenantId' = $2 AND data->>'asOf' = $3`,
      [FIGURES_WARM_QUEUE, A, day],
    );
    expect(queued.rows[0].n).toBe(1);
    await warmServedRun(f.db.app, { tenantId: A, asOf: day });
    resetEngineRunsInRead();
    const after = await read(day, 'head', { ...gz, 'if-none-match': String(before.headers.etag) });
    expect(after.statusCode).toBe(200);
    expect(after.headers.etag).not.toBe(before.headers.etag);
    expect(unzipped(after).figures).toEqual((await fresh(day)).figures);
    expect(engineRunsInRead()).toBe(0);
  });
});
