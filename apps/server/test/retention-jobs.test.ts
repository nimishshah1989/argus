import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runRetentionJob } from '../src/retention.js';
import { importBhavin, undoImport } from '../src/modules/imports/bhavin.js';
import { makeSyntheticExport, seedSyntheticTenant, syntheticIds } from './import-fixture.js';
import { startTestDb, type TestDb } from './harness.js';

/** The fake clock: every job gets this instant, so "30 days ago" is exact and nothing depends on the real time. */
const NOW = new Date('2027-06-15T03:00:00Z');
const DAY = 86_400_000;
const ago = (days: number, extraMs = 0): Date => new Date(NOW.getTime() - days * DAY - extraMs);

const A = 'a1000000-0000-0000-0000-000000000001';
const B = 'b1000000-0000-0000-0000-000000000001';
const SUSPENDED = 'c1000000-0000-0000-0000-000000000001';

let db: TestDb;
const logins = new Map<string, string>();

async function tenant(id: string, slug: string, status = 'active'): Promise<void> {
  await db.admin.query('INSERT INTO tenant (id, slug, name, status) VALUES ($1, $2, $2, $3)', [
    id,
    slug,
    status,
  ]);
  const person = randomUUID();
  const login = randomUUID();
  await db.admin.query('INSERT INTO person (id, tenant_id, name) VALUES ($1, $2, $3)', [
    person,
    id,
    `Person ${slug}`,
  ]);
  await db.admin.query(
    "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, $4, 'h', 'technician', false)",
    [login, id, person, `user-${slug}`],
  );
  logins.set(id, login);
}

beforeAll(async () => {
  db = await startTestDb();
  await tenant(A, 'alpha');
  await tenant(B, 'bravo');
  await tenant(SUSPENDED, 'suspended', 'suspended');
}, 180_000);

afterAll(async () => {
  await db.stop();
});

const count = async (table: string, tenantId: string, where = 'true'): Promise<number> =>
  (
    await db.admin.query(
      `SELECT count(*)::int AS n FROM ${table} WHERE tenant_id = $1 AND (${where})`,
      [tenantId],
    )
  ).rows[0].n;

describe('session.purge', () => {
  async function session(
    tenantId: string,
    label: string,
    expiresAt: Date,
    revokedAt: Date | null = null,
  ): Promise<void> {
    await db.admin.query(
      `INSERT INTO session (tenant_id, login_id, token_hash, device_label, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, logins.get(tenantId), randomUUID(), label, expiresAt, revokedAt],
    );
  }
  const labels = async (tenantId: string): Promise<string[]> =>
    (
      await db.admin.query(
        'SELECT device_label FROM session WHERE tenant_id = $1 ORDER BY device_label',
        [tenantId],
      )
    ).rows.map((r) => r.device_label);

  it('deletes sessions dead for over 30 days, keeps the rest, and a second run does nothing', async () => {
    await session(A, 'expired-31d', ago(31));
    await session(A, 'expired-just-past-30d', ago(30, 1000));
    await session(A, 'expired-exactly-30d', ago(30));
    await session(A, 'expired-29d', ago(29));
    await session(A, 'revoked-40d-expiry-in-future', new Date(NOW.getTime() + 20 * DAY), ago(40));
    await session(A, 'revoked-5d-expiry-in-future', new Date(NOW.getTime() + 20 * DAY), ago(5));
    await session(A, 'revoked-5d-expired-40d', ago(40), ago(5));
    await session(A, 'live', new Date(NOW.getTime() + 10 * DAY));
    await session(SUSPENDED, 'suspended-expired-60d', ago(60));
    await session(B, 'other-expired-60d', ago(60));

    const first = await runRetentionJob(db.app, 'session.purge', { now: NOW, tenantId: A });
    expect(first.affected).toBe(4);
    expect(await labels(A)).toEqual([
      'expired-29d',
      'expired-exactly-30d',
      'live',
      'revoked-5d-expiry-in-future',
    ]);
    // Another customer is untouched when one customer is named.
    expect(await labels(B)).toEqual(['other-expired-60d']);

    const second = await runRetentionJob(db.app, 'session.purge', { now: NOW, tenantId: A });
    expect(second.affected).toBe(0);
    expect(await labels(A)).toHaveLength(4);
  });

  it('with no customer named, sweeps every customer that still holds data, one at a time', async () => {
    const all = await runRetentionJob(db.app, 'session.purge', { now: NOW });
    expect(all.tenants).toBeGreaterThanOrEqual(3);
    expect(await labels(B)).toEqual([]);
    expect(await labels(SUSPENDED)).toEqual([]);
    expect(await labels(A)).toContain('live');
    expect((await runRetentionJob(db.app, 'session.purge', { now: NOW })).affected).toBe(0);
  });
});

describe('idempotency.purge', () => {
  async function key(tenantId: string, name: string, createdAt: Date): Promise<void> {
    await db.admin.query(
      `INSERT INTO command_idempotency (tenant_id, login_id, key, command, request_hash, result, created_at)
       VALUES ($1, $2, $3, 'close', 'hash', '{}', $4)`,
      [tenantId, logins.get(tenantId), name, createdAt],
    );
  }
  const keys = async (tenantId: string): Promise<string[]> =>
    (
      await db.admin.query(
        'SELECT key FROM command_idempotency WHERE tenant_id = $1 ORDER BY key',
        [tenantId],
      )
    ).rows.map((r) => r.key);

  it('deletes keys over 30 days old, keeps newer ones and other customers, and re-runs as a no-op', async () => {
    await key(A, 'a-31d', ago(31));
    await key(A, 'a-exactly-30d', ago(30));
    await key(A, 'a-1d', ago(1));
    await key(B, 'b-90d', ago(90));
    // A ticket's own history must not be touched by key clean-up.
    const ticketId = randomUUID();
    await db.admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
       VALUES ($1, $2, 'BD-0001', 'stopped', 'open', 'x', $3, 'S3')`,
      [ticketId, A, ago(200)],
    );
    await db.admin.query(
      "INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, idempotency_key, at) VALUES ($1, $2, 1, 'down', 'a-31d', $3)",
      [A, ticketId, ago(200)],
    );

    const first = await runRetentionJob(db.app, 'idempotency.purge', { now: NOW, tenantId: A });
    expect(first.affected).toBe(1);
    expect(await keys(A)).toEqual(['a-1d', 'a-exactly-30d']);
    expect(await keys(B)).toEqual(['b-90d']);
    expect(await count('ticket', A)).toBe(1);
    expect(await count('ticket_event', A)).toBe(1);

    expect((await runRetentionJob(db.app, 'idempotency.purge', { now: NOW })).affected).toBe(1);
    expect(await keys(B)).toEqual([]);
    expect((await runRetentionJob(db.app, 'idempotency.purge', { now: NOW })).affected).toBe(0);
    expect(await keys(A)).toEqual(['a-1d', 'a-exactly-30d']);
  });
});

describe('import.purge', () => {
  const rawBody = (secret: string) => ({
    format: 'argus.import-raw/v1',
    raw: { entryType: 'ordinary', legacyId: 'L-1', problem: secret },
    canonicalJson: `{"problem":"${secret}"}`,
    rawSha256: 'raw-sha',
    identitySha256: 'identity-sha',
  });

  async function batch(
    tenantId: string,
    status: string,
    finishedAt: Date | null,
    secret: string,
  ): Promise<{ batchId: string; rowId: string }> {
    const batchId = randomUUID();
    const rowId = randomUUID();
    await db.admin.query(
      `INSERT INTO import_batch (id, tenant_id, source, status, started_at, finished_at, stats)
       VALUES ($1, $2, 'bhavin', $3, $4, $4, '{}')`,
      [batchId, tenantId, status, finishedAt],
    );
    await db.admin.query(
      `INSERT INTO import_row (id, tenant_id, batch_id, row_number, source_ref, status, payload)
       VALUES ($1, $2, $3, 1, $4, 'imported', $5)`,
      [rowId, tenantId, batchId, `src-${rowId}`, JSON.stringify(rawBody(secret))],
    );
    return { batchId, rowId };
  }
  const payloadOf = async (rowId: string) =>
    (await db.admin.query('SELECT payload FROM import_row WHERE id = $1', [rowId])).rows[0]
      .payload as Record<string, unknown>;

  it('strips the source content a year after the batch is done, keeps what replay and undo read', async () => {
    const old = await batch(A, 'done', ago(366), 'SECRET-OLD');
    const edge = await batch(A, 'done', ago(365), 'SECRET-EDGE');
    const recent = await batch(A, 'done', ago(364), 'SECRET-RECENT');
    const failed = await batch(A, 'failed', ago(500), 'SECRET-FAILED');
    const undone = await batch(A, 'undone', ago(500), 'SECRET-UNDONE');
    const other = await batch(B, 'done', ago(900), 'SECRET-OTHER');

    const first = await runRetentionJob(db.app, 'import.purge', { now: NOW, tenantId: A });
    expect(first.affected).toBe(1);
    const stripped = await payloadOf(old.rowId);
    expect(JSON.stringify(stripped)).not.toContain('SECRET');
    expect(stripped).toMatchObject({
      format: 'argus.import-raw/v1',
      identitySha256: 'identity-sha',
      rawSha256: 'raw-sha',
      raw: { entryType: 'ordinary' },
    });
    for (const kept of [edge, recent, failed, undone, other]) {
      expect(JSON.stringify(await payloadOf(kept.rowId))).toContain('SECRET');
    }
    // The row itself and its batch stay.
    expect(await count('import_row', A, `id = '${old.rowId}'`)).toBe(1);
    expect(await count('import_batch', A, `id = '${old.batchId}'`)).toBe(1);

    expect(
      (await runRetentionJob(db.app, 'import.purge', { now: NOW, tenantId: A })).affected,
    ).toBe(0);
    expect((await runRetentionJob(db.app, 'import.purge', { now: NOW })).affected).toBe(1);
    expect(JSON.stringify(await payloadOf(other.rowId))).not.toContain('SECRET');
    expect((await runRetentionJob(db.app, 'import.purge', { now: NOW })).affected).toBe(0);
  });

  it('after the purge a re-run of the same file is still skipped and the batch can still be undone', async () => {
    await db.admin.query('DELETE FROM tenant WHERE id = $1', [syntheticIds.tenant]);
    await seedSyntheticTenant(db.admin);
    const input = makeSyntheticExport();
    const first = await importBhavin(db.app, syntheticIds.tenant, input);
    expect(first.stats).toMatchObject({ imported: 1, status: 'done' });
    // Move the fake clock past the year instead of backdating the batch: undo checks the ticket was not touched later.
    const later = new Date(Date.now() + 400 * DAY);

    const purged = await runRetentionJob(db.app, 'import.purge', {
      now: later,
      tenantId: syntheticIds.tenant,
    });
    expect(purged.affected).toBe(1);

    const rerun = await importBhavin(db.app, syntheticIds.tenant, input);
    expect(rerun.stats).toMatchObject({ imported: 0, skipped: 1, status: 'done' });
    expect(await count('ticket', syntheticIds.tenant)).toBe(1);

    const undone = await undoImport(db.router, syntheticIds.tenant, first.batchId, 'agent-test');
    expect(undone.deleted).toBe(1);
    expect(await count('ticket', syntheticIds.tenant)).toBe(0);
  });
});
