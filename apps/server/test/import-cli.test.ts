import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  emptyCompletionFingerprint,
  makeCompletionFingerprint,
} from '../src/modules/imports/fingerprint.js';
import { loadBatchSnapshot } from '../src/modules/imports/fingerprint-sql.js';
import type { ImportStats } from '../src/modules/imports/schema.js';
import { hashToken } from '../src/session.js';
import {
  makeOrdinaryTicket,
  makeSyntheticExport,
  seedSyntheticTenant,
  syntheticIds,
  syntheticSource,
} from './import-fixture.js';
import { APP_API_PASSWORD, startTestDb, type TestDb } from './harness.js';
import {
  CliUsageError,
  assertAppApiRole,
  assertProductionAccess,
  parseCliArgs,
  type CliCommand,
} from '../src/modules/imports/security.js';

const BATCH_ID = '10000000-0000-0000-0000-000000000001';
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function runPnpm(args: string[], overrides: NodeJS.ProcessEnv = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, APP_ENV: 'production', ...overrides };
  if (!('DATABASE_URL' in overrides)) delete env.DATABASE_URL;
  return spawnSync('pnpm', ['--silent', ...args], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 1_048_576,
  });
}

function rolePool(
  rows: Array<{ name: string; rolsuper: boolean; rolbypassrls: boolean }>,
  error?: Error,
): { pool: Pool; query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> } {
  const query = vi.fn().mockImplementation(() => {
    if (error) return Promise.reject(error);
    return Promise.resolve({ rows });
  });
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
  return { pool, query, release };
}

const importCommand: CliCommand = {
  mode: 'import',
  file: 'synthetic.json',
  tenantSlug: 'cosmos',
  productionConfirm: false,
};

describe('CLI argument and production guards (T16)', () => {
  it('parses exactly one import or undo target with its tenant and confirmation', () => {
    expect(parseCliArgs(['synthetic.json', '--tenant', 'cosmos'])).toEqual(importCommand);
    expect(parseCliArgs(['synthetic.json', '--tenant', 'cosmos', '--production-confirm'])).toEqual({
      ...importCommand,
      productionConfirm: true,
    });
    expect(parseCliArgs(['undo', BATCH_ID, '--tenant', 'plant-two'])).toEqual({
      mode: 'undo',
      batchId: BATCH_ID,
      tenantSlug: 'plant-two',
      productionConfirm: false,
    });
  });

  it.each(
    [
      [],
      ['undo'],
      ['--tenant', 'cosmos'],
      ['synthetic.json'],
      ['synthetic.json', '--tenant'],
      ['synthetic.json', '--tenant', '--production-confirm'],
      ['synthetic.json', '--tenant', 'cosmos', '--tenant', 'plant-two'],
      ['synthetic.json', '--tenant', 'cosmos', '--production-confirm', '--production-confirm'],
      ['synthetic.json', '--tenant', 'cosmos', '--unknown'],
      ['-x', '--tenant', 'cosmos'],
      ['synthetic.json', '--tenant', 'cosmos', 'extra.json'],
      ['synthetic.json', '--tenant', 'Cosmos'],
      ['synthetic.json', '--tenant', '-cosmos'],
      ['synthetic.json', '--tenant', 'cosmos-'],
      ['undo', 'not-a-uuid', '--tenant', 'cosmos'],
      ['undo', BATCH_ID.toUpperCase(), '--tenant', 'cosmos', 'extra'],
    ].map((argv) => ({ argv })),
  )('rejects invalid or repeated arguments before any database work: %j', ({ argv }) => {
    expect(() => parseCliArgs(argv)).toThrow(CliUsageError);
    try {
      parseCliArgs(argv);
    } catch (error) {
      expect(error).toBeInstanceOf(CliUsageError);
      expect((error as CliUsageError).exitCode).toBe(2);
    }
  });

  it('accepts only staging or explicit production confirmation for both write commands', () => {
    const undoCommand: CliCommand = {
      mode: 'undo',
      batchId: BATCH_ID,
      tenantSlug: 'cosmos',
      productionConfirm: false,
    };
    for (const command of [importCommand, undoCommand]) {
      expect(() => assertProductionAccess(command, 'staging')).not.toThrow();
      expect(() => assertProductionAccess(command, undefined)).toThrow(/staging|production/i);
      expect(() => assertProductionAccess(command, 'development')).toThrow(/staging|production/i);
      expect(() => assertProductionAccess(command, 'production')).toThrow(/production/i);
      expect(() =>
        assertProductionAccess({ ...command, productionConfirm: true }, 'production'),
      ).not.toThrow();
    }
  });
});

describe('app_api role guard (T17)', () => {
  it('requires exactly app_api with neither superuser nor RLS bypass and releases its client', async () => {
    const { pool, query, release } = rolePool([
      { name: 'app_api', rolsuper: false, rolbypassrls: false },
    ]);
    await expect(assertAppApiRole(pool)).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith(
      'SELECT current_user AS name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user',
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it.each(
    [
      [],
      [{ name: 'app_user', rolsuper: false, rolbypassrls: false }],
      [{ name: 'app_api', rolsuper: true, rolbypassrls: false }],
      [{ name: 'app_api', rolsuper: false, rolbypassrls: true }],
      [
        { name: 'app_api', rolsuper: false, rolbypassrls: false },
        { name: 'app_api', rolsuper: false, rolbypassrls: false },
      ],
    ].map((rows) => ({ rows })),
  )('fails closed for a missing, wrong, privileged, or ambiguous role: %j', async ({ rows }) => {
    const { pool, release } = rolePool(rows);
    await expect(assertAppApiRole(pool)).rejects.toThrow(/app_api/i);
    expect(release).toHaveBeenCalledOnce();
  });

  it('propagates role-query failure instead of warning and releases the client', async () => {
    const { pool, release } = rolePool([], new Error('role query unavailable'));
    await expect(assertAppApiRole(pool)).rejects.toThrow(/app_api/i);
    expect(release).toHaveBeenCalledOnce();
  });

  it('fails closed when the dedicated connection cannot be acquired', async () => {
    const pool = {
      connect: vi.fn().mockRejectedValue(new Error('connection unavailable')),
    } as unknown as Pool;
    await expect(assertAppApiRole(pool)).rejects.toThrow(/app_api/i);
  });
});

describe('real CLI subprocess guards (T16)', () => {
  it.each(
    [
      ['import:bhavin'],
      ['import:bhavin', 'synthetic.json'],
      ['import:bhavin', 'synthetic.json', '--tenant', 'cosmos', '--tenant', 'cosmos'],
      ['import:undo', 'not-a-uuid', '--tenant', 'cosmos'],
    ].map((args) => ({ args })),
  )('returns usage exit 2 before touching the database: %j', ({ args }) => {
    const result = runPnpm(args);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('usage: import:');
    expect(result.stderr).not.toContain('DATABASE_URL is required');
  });

  it('rejects unconfirmed production import and undo before file or database work', () => {
    for (const args of [
      ['import:bhavin', 'not-read.json', '--tenant', 'cosmos'],
      ['import:undo', BATCH_ID, '--tenant', 'cosmos'],
    ]) {
      const result = runPnpm(args);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toMatch(/APP_ENV=staging|--production-confirm/);
      expect(result.stderr).not.toMatch(/DATABASE_URL|ENOENT/);
    }
  });
});

interface CommandOptions {
  url?: string;
  tenant?: string;
  appEnv?: string;
  productionConfirm?: boolean;
}

describe('real CLI import and undo (T13–T20)', () => {
  let db: TestDb;
  let filesDir: string;
  let fileNumber = 0;

  function appApiUrl(): string {
    return `postgresql://app_api:${APP_API_PASSWORD}@${db.container.getHost()}:${db.container.getPort()}/${db.container.getDatabase()}`;
  }

  function runImport(file: string, options: CommandOptions = {}) {
    const args = [
      'import:bhavin',
      file,
      '--tenant',
      options.tenant ?? 'cosmos',
      ...(options.productionConfirm ? ['--production-confirm'] : []),
    ];
    return runPnpm(args, {
      APP_ENV: options.appEnv ?? 'staging',
      DATABASE_URL: options.url ?? appApiUrl(),
    });
  }

  function runUndo(batchId: string, options: CommandOptions = {}) {
    const args = [
      'import:undo',
      batchId,
      '--tenant',
      options.tenant ?? 'cosmos',
      ...(options.productionConfirm ? ['--production-confirm'] : []),
    ];
    return runPnpm(args, {
      APP_ENV: options.appEnv ?? 'staging',
      DATABASE_URL: options.url ?? appApiUrl(),
    });
  }

  async function inputFile(contents: string | Buffer): Promise<string> {
    fileNumber += 1;
    const file = join(filesDir, `input-${fileNumber}.json`);
    await writeFile(file, contents);
    return file;
  }

  async function jsonFile(input: unknown): Promise<string> {
    return inputFile(JSON.stringify(input));
  }

  function importOutput(result: ReturnType<typeof runPnpm>): {
    batchId: string;
    stats: ImportStats;
  } {
    return JSON.parse(result.stdout) as { batchId: string; stats: ImportStats };
  }

  async function batchCount(): Promise<number> {
    const result = await db.admin.query('SELECT count(*)::int AS n FROM import_batch');
    return result.rows[0].n as number;
  }

  beforeAll(async () => {
    db = await startTestDb();
    filesDir = await mkdtemp(join(tmpdir(), 'synthetic-import-cli-'));
    await db.admin.query(
      "CREATE ROLE synthetic_bypass LOGIN BYPASSRLS PASSWORD 'synthetic-bypass-password'",
    );
  }, 120_000);

  beforeEach(async () => {
    await db.admin.query('DELETE FROM tenant');
    await seedSyntheticTenant(db.admin);
    await db.admin.query("UPDATE tenant SET slug = 'cosmos' WHERE id = $1", [syntheticIds.tenant]);
    await db.admin.query(
      "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 100), ($1, 'WR', 1)",
      [syntheticIds.tenant],
    );
  });

  afterAll(async () => {
    await rm(filesDir, { recursive: true, force: true });
    await db.stop();
  });

  it(
    'T13 imports as app_api and reports exact ticket and completion data',
    { timeout: 120_000 },
    async () => {
      const result = runImport(await jsonFile(makeSyntheticExport()));
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      const { batchId, stats } = importOutput(result);
      expect(stats).toMatchObject({
        contract: syntheticSource,
        status: 'done',
        tickets: 1,
        imported: 1,
        skipped: 0,
        errored: 0,
        events: 4,
        crew: 2,
        segments: 2,
        reports: 1,
        reportPeople: 2,
        hardMismatches: 0,
      });
      const stored = await db.admin.query(
        `SELECT t.*, ir.source_ref, ir.row_number, b.status AS batch_status, b.stats
       FROM ticket t
       JOIN import_row ir ON ir.ticket_id = t.id AND ir.tenant_id = t.tenant_id
       JOIN import_batch b ON b.id = ir.batch_id AND b.tenant_id = ir.tenant_id
       WHERE t.tenant_id = $1 AND b.id = $2`,
        [syntheticIds.tenant, batchId],
      );
      expect(stored.rows).toHaveLength(1);
      expect(stored.rows[0]).toMatchObject({
        ref: 'BD-0100',
        raised_channel: 'import',
        last_event_seq: 3,
        response_min: 5,
        active_min: 55,
        repair_min: 55,
        downtime_min: 60,
        source_ref: 'synthetic-legacy-0100',
        row_number: 1,
        batch_status: 'done',
      });
      const client = await db.admin.connect();
      try {
        const snapshot = await loadBatchSnapshot(client, syntheticIds.tenant, batchId, false);
        expect(stats.completion).toEqual(makeCompletionFingerprint(snapshot));
      } finally {
        client.release();
      }
    },
  );

  it(
    'T14 exits 1 with a persisted failed batch and all row outcomes',
    { timeout: 120_000 },
    async () => {
      const first = makeOrdinaryTicket();
      const malformed = makeOrdinaryTicket({ legacyId: 'synthetic-bad', ref: 'BD-0101' });
      const last = makeOrdinaryTicket({ legacyId: 'synthetic-last', ref: 'BD-0102' });
      const result = runImport(
        await jsonFile(makeSyntheticExport([first, { ...malformed, problem: null }, last])),
      );
      expect(result.status).toBe(1);
      const { batchId, stats } = importOutput(result);
      expect(stats).toMatchObject({ status: 'failed', imported: 2, skipped: 0, errored: 1 });
      expect(stats.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rowNumber: 2,
            legacyId: 'synthetic-bad',
            ref: 'BD-0101',
            severity: 'error',
          }),
        ]),
      );
      const batch = await db.admin.query(
        'SELECT status, finished_at FROM import_batch WHERE id = $1',
        [batchId],
      );
      expect(batch.rows[0].status).toBe('failed');
      expect(batch.rows[0].finished_at).toBeInstanceOf(Date);
      const rows = await db.admin.query(
        `SELECT row_number, source_ref, status, payload->>'format' AS format
       FROM import_row WHERE tenant_id = $1 AND batch_id = $2 ORDER BY row_number`,
        [syntheticIds.tenant, batchId],
      );
      expect(rows.rows).toEqual([
        {
          row_number: 1,
          source_ref: 'synthetic-legacy-0100',
          status: 'imported',
          format: 'argus.import-raw/v1',
        },
        {
          row_number: 2,
          source_ref: 'synthetic-bad',
          status: 'error',
          format: 'argus.import-raw/v1',
        },
        {
          row_number: 3,
          source_ref: 'synthetic-last',
          status: 'imported',
          format: 'argus.import-raw/v1',
        },
      ]);
    },
  );

  it(
    'T15 rejects source and oversize files before a batch and accepts the exact byte cap',
    { timeout: 120_000 },
    async () => {
      const wrongSource = runImport(
        await jsonFile({ ...makeSyntheticExport([]), source: 'bhavin-v3' }),
      );
      expect(wrongSource.status).not.toBe(0);
      expect(wrongSource.stdout).toBe('');
      expect(wrongSource.stderr).toMatch(/source|contract/i);
      expect(await batchCount()).toBe(0);

      const oversized = runImport(await inputFile(Buffer.alloc(5_242_881, 32)));
      expect(oversized.status).not.toBe(0);
      expect(oversized.stdout).toBe('');
      expect(oversized.stderr).toMatch(/5242880|bytes/i);
      expect(await batchCount()).toBe(0);

      const valid = Buffer.from(JSON.stringify(makeSyntheticExport([])));
      const exact = Buffer.concat([valid, Buffer.alloc(5_242_880 - valid.length, 32)]);
      expect(exact.length).toBe(5_242_880);
      const accepted = runImport(await inputFile(exact));
      expect(accepted.status).toBe(0);
      expect(importOutput(accepted).stats).toMatchObject({ status: 'done', tickets: 0 });
      expect(await batchCount()).toBe(1);
    },
  );

  it(
    'T16 allows confirmed staging and production writes against disposable Postgres',
    { timeout: 120_000 },
    async () => {
      const file = await jsonFile(makeSyntheticExport([]));
      for (const appEnv of ['staging', 'production']) {
        const result = runImport(file, { appEnv, productionConfirm: true });
        expect(result.status).toBe(0);
        expect(importOutput(result).stats.status).toBe('done');
      }
      expect(await batchCount()).toBe(2);
    },
  );

  it(
    'T17 rejects owner and bypass-RLS roles before tenant resolution',
    { timeout: 120_000 },
    async () => {
      const file = await jsonFile(makeSyntheticExport([]));
      const bypassUrl = `postgresql://synthetic_bypass:synthetic-bypass-password@${db.container.getHost()}:${db.container.getPort()}/${db.container.getDatabase()}`;
      for (const url of [db.container.getConnectionUri(), bypassUrl]) {
        for (const result of [
          runImport(file, { url, tenant: 'missing' }),
          runUndo(BATCH_ID, { url, tenant: 'missing' }),
        ]) {
          expect(result.status).toBe(1);
          expect(result.stdout).toBe('');
          expect(result.stderr).toMatch(/app_api/i);
          expect(result.stderr).not.toMatch(/Unknown tenant/i);
        }
      }
      expect(await batchCount()).toBe(0);
    },
  );

  it('T18 refuses cross-tenant and non-Bhavin provenance undo', { timeout: 120_000 }, async () => {
    const otherTenant = randomUUID();
    const otherBatch = randomUUID();
    await db.admin.query(
      "INSERT INTO tenant (id, slug, name) VALUES ($1, 'plant-two', 'Synthetic Other')",
      [otherTenant],
    );
    await db.admin.query(
      `INSERT INTO import_batch (id, tenant_id, source, status, started_at, finished_at, stats)
       VALUES ($1, $2, 'bhavin', 'done', now(), now(), $3)`,
      [
        otherBatch,
        otherTenant,
        JSON.stringify({ contract: syntheticSource, completion: emptyCompletionFingerprint() }),
      ],
    );
    const crossTenant = runUndo(otherBatch);
    expect(crossTenant.status).not.toBe(0);
    expect(crossTenant.stderr).toMatch(/not found/i);
    const untouched = await db.admin.query('SELECT status FROM import_batch WHERE id = $1', [
      otherBatch,
    ]);
    expect(untouched.rows[0].status).toBe('done');

    const ticketId = randomUUID();
    const seedBatch = randomUUID();
    await db.admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
       VALUES ($1, $2, 'BD-9000', 'stopped', 'open', 'Synthetic pre-existing', now(), 'S3')`,
      [ticketId, syntheticIds.tenant],
    );
    await db.admin.query(
      `INSERT INTO import_batch (id, tenant_id, source, status, started_at, finished_at)
       VALUES ($1, $2, 'seed', 'done', now(), now())`,
      [seedBatch, syntheticIds.tenant],
    );
    await db.admin.query(
      `INSERT INTO import_row (tenant_id, batch_id, row_number, source_ref, status, payload, ticket_id)
       VALUES ($1, $2, 1, 'synthetic-seed', 'imported', $3, $4)`,
      [
        syntheticIds.tenant,
        seedBatch,
        JSON.stringify({ format: 'argus.import-raw/v1', raw: makeOrdinaryTicket() }),
        ticketId,
      ],
    );
    const wrongSource = runUndo(seedBatch);
    expect(wrongSource.status).not.toBe(0);
    expect(wrongSource.stderr).toMatch(/not found|source/i);
    const preserved = await db.admin.query(
      'SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1 AND id = $2',
      [syntheticIds.tenant, ticketId],
    );
    expect(preserved.rows[0].n).toBe(1);
  });

  it(
    'T19 refuses undo after a real HTTP command appends later work',
    { timeout: 120_000 },
    async () => {
      const imported = runImport(await jsonFile(makeSyntheticExport()));
      expect(imported.status).toBe(0);
      const { batchId } = importOutput(imported);
      const ticket = await db.admin.query('SELECT id FROM ticket WHERE tenant_id = $1', [
        syntheticIds.tenant,
      ]);
      const ticketId = ticket.rows[0].id as string;
      const loginId = randomUUID();
      const sessionId = randomUUID();
      const token = 'synthetic-cli-session';
      await db.admin.query(
        `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role)
       VALUES ($1, $2, $3, 'synthetic-cli', 'unused', 'technician')`,
        [loginId, syntheticIds.tenant, syntheticIds.asha],
      );
      await db.admin.query(
        `INSERT INTO session (id, tenant_id, login_id, token_hash, expires_at, acting_person_id)
       VALUES ($1, $2, $3, $4, now() + interval '1 hour', $5)`,
        [sessionId, syntheticIds.tenant, loginId, hashToken(token), syntheticIds.asha],
      );
      const app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
      try {
        const response = await app.inject({
          method: 'POST',
          url: `/api/v1/tickets/${ticketId}/machine-running`,
          headers: {
            host: 'cosmos.localhost',
            authorization: `Bearer ${token}`,
            'idempotency-key': randomUUID(),
          },
          payload: { personId: syntheticIds.asha },
        });
        expect(response.statusCode).toBe(200);
      } finally {
        await app.close();
      }
      const refused = runUndo(batchId);
      expect(refused.status).not.toBe(0);
      expect(refused.stderr).toMatch(/fingerprint|mismatch|later work/i);
      const state = await db.admin.query(
        `SELECT b.status, count(t.id)::int AS tickets,
        (SELECT count(*)::int FROM ticket_event WHERE tenant_id = $1 AND ticket_id = $2) AS events,
        (SELECT count(*)::int FROM audit_log WHERE tenant_id = $1 AND entity_id = $3) AS audits
       FROM import_batch b LEFT JOIN ticket t ON t.tenant_id = b.tenant_id AND t.id = $2
       WHERE b.tenant_id = $1 AND b.id = $3 GROUP BY b.status`,
        [syntheticIds.tenant, ticketId, batchId],
      );
      expect(state.rows[0]).toMatchObject({ status: 'done', tickets: 1, events: 5, audits: 0 });
    },
  );

  it('T20 completes one audited undo and rejects every repeat', { timeout: 120_000 }, async () => {
    const imported = runImport(await jsonFile(makeSyntheticExport()));
    expect(imported.status).toBe(0);
    const { batchId, stats } = importOutput(imported);
    const before = await db.admin.query(
      `SELECT b.finished_at, ir.payload, ir.source_ref, ir.status, t.id AS ticket_id,
        (SELECT count(*)::int FROM person WHERE tenant_id = $1) AS people,
        (SELECT next_value FROM ref_counter WHERE tenant_id = $1 AND prefix = 'BD') AS counter,
        (SELECT count(*)::int FROM ticket_event WHERE tenant_id = $1 AND ticket_id = t.id) AS events,
        (SELECT count(*)::int FROM crew_member WHERE tenant_id = $1 AND ticket_id = t.id) AS crew,
        (SELECT count(*)::int FROM work_segment WHERE tenant_id = $1 AND ticket_id = t.id) AS segments,
        (SELECT count(*)::int FROM breakdown_report WHERE tenant_id = $1 AND ticket_id = t.id) AS reports
       FROM import_batch b
       JOIN import_row ir ON ir.batch_id = b.id AND ir.tenant_id = b.tenant_id
       JOIN ticket t ON t.id = ir.ticket_id AND t.tenant_id = ir.tenant_id
       WHERE b.tenant_id = $1 AND b.id = $2`,
      [syntheticIds.tenant, batchId],
    );
    expect(before.rows[0]).toMatchObject({ events: 4, crew: 2, segments: 2, reports: 1 });
    const original = before.rows[0];

    const first = runUndo(batchId);
    expect(first.status).toBe(0);
    expect(JSON.parse(first.stdout)).toEqual({ batchId, deleted: 1 });
    const repeat = runUndo(batchId);
    expect(repeat.status).not.toBe(0);
    expect(repeat.stderr).toMatch(/undone|status/i);

    const after = await db.admin.query(
      `SELECT b.status, b.finished_at, ir.payload, ir.source_ref, ir.status AS row_status,
        ir.ticket_id, (SELECT count(*)::int FROM ticket WHERE tenant_id = $1 AND id = $3) AS tickets,
        (SELECT count(*)::int FROM ticket_event WHERE tenant_id = $1 AND ticket_id = $3) AS events,
        (SELECT count(*)::int FROM crew_member WHERE tenant_id = $1 AND ticket_id = $3) AS crew,
        (SELECT count(*)::int FROM work_segment WHERE tenant_id = $1 AND ticket_id = $3) AS segments,
        (SELECT count(*)::int FROM breakdown_report WHERE tenant_id = $1 AND ticket_id = $3) AS reports,
        (SELECT count(*)::int FROM person WHERE tenant_id = $1) AS people,
        (SELECT next_value FROM ref_counter WHERE tenant_id = $1 AND prefix = 'BD') AS counter
       FROM import_batch b JOIN import_row ir ON ir.batch_id = b.id AND ir.tenant_id = b.tenant_id
       WHERE b.tenant_id = $1 AND b.id = $2`,
      [syntheticIds.tenant, batchId, original.ticket_id],
    );
    expect(after.rows[0]).toMatchObject({
      status: 'undone',
      source_ref: original.source_ref,
      row_status: original.status,
      ticket_id: null,
      tickets: 0,
      events: 0,
      crew: 0,
      segments: 0,
      reports: 0,
      people: original.people,
      counter: original.counter,
    });
    expect(after.rows[0].payload).toEqual(original.payload);
    expect(after.rows[0].finished_at).toEqual(original.finished_at);
    const audits = await db.admin.query(
      `SELECT login_id, action, entity, entity_id, ip, before, after
       FROM audit_log WHERE tenant_id = $1 AND entity_id = $2`,
      [syntheticIds.tenant, batchId],
    );
    expect(audits.rows).toHaveLength(1);
    expect(audits.rows[0]).toMatchObject({
      login_id: null,
      action: 'import.undo',
      entity: 'import_batch',
      entity_id: batchId,
      ip: null,
      before: {
        status: 'done',
        fingerprintDigest: stats.completion?.digest,
        ticketIds: [original.ticket_id],
      },
      after: { status: 'undone', deleted: 1 },
    });
  });
});
