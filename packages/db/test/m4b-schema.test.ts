import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Migration 0015 seen the way the M4b features will use it: as `app_user` for every write, and as the non-superuser
 * owner the runner really uses when it reverts the file. The seed already has one row per tenant in each of the four
 * tables, so the isolation test's one-row rule stays true.
 */
const execFileAsync = promisify(execFile);
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SEED = readFileSync(new URL('./seed.sql', import.meta.url), 'utf8');
const DOWN = readFileSync(
  new URL('../migrations/down/0015_m4b_schema.down.sql', import.meta.url),
  'utf8',
);

const A = '10000000-0000-0000-0000-000000000001';
const B = '20000000-0000-0000-0000-000000000001';
const TICKET_A = '10000000-0000-0000-0000-00000000000e';
const MACHINE_A = '10000000-0000-0000-0000-000000000008';
const FORECAST_A = '10000000-0000-0000-0000-000000000024';
const PM_PLAN_B = '20000000-0000-0000-0000-000000000025';
const OWNER_PASSWORD = 'm4b-owner-password';

let container: StartedPostgreSqlContainer;
let db: Client;
let ownerUrl: string;

const asPlant = (tenant: string) =>
  db.query("SELECT set_config('app.tenant_id', $1, false)", [tenant]);

const ticket = (channel: string, ref: string) =>
  db.query(
    `INSERT INTO ticket (tenant_id, ref, kind, status, problem, reported_at, severity, raised_channel)
     VALUES (current_setting('app.tenant_id')::uuid, $1, 'stopped', 'open', 'm4b test', now(), 'S3', $2)
     RETURNING id`,
    [ref, channel],
  );

const listItem = (list: string, code: string, active = true) =>
  db.query(
    `INSERT INTO list_item (tenant_id, list, code, label, active)
     VALUES (current_setting('app.tenant_id')::uuid, $1, $2, $2, $3)`,
    [list, code, active],
  );

const report = (fields: {
  problem: string;
  component?: string;
  mode?: string;
  cause?: string;
  action?: string;
  pm?: unknown;
}) =>
  db.query(
    `INSERT INTO breakdown_report
       (tenant_id, ticket_id, machine_id, date, shift_code, problem,
        failure_component, failure_mode, failure_cause, failure_action, pm_report)
     VALUES (current_setting('app.tenant_id')::uuid, $1, $2, current_date, '1', $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      TICKET_A,
      MACHINE_A,
      fields.problem,
      fields.component ?? null,
      fields.mode ?? null,
      fields.cause ?? null,
      fields.action ?? null,
      fields.pm === undefined ? null : JSON.stringify(fields.pm),
    ],
  );

const count = async (table: string): Promise<number> =>
  (await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n as number;

const runMigration = () =>
  execFileAsync('pnpm', ['tsx', 'scripts/migrate.ts'], {
    cwd: ROOT,
    env: { ...process.env, MIGRATION_DATABASE_URL: ownerUrl, MIGRATION_ADOPT_THROUGH: '' },
    maxBuffer: 1024 * 1024,
  });

function databaseUrl(base: string, name: string): string {
  const url = new URL(base);
  url.pathname = `/${name}`;
  return url.toString();
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const admin = new Client({ connectionString: container.getConnectionUri() });
  await admin.connect();
  await admin.query(`CREATE ROLE m4b_owner LOGIN CREATEDB CREATEROLE PASSWORD '${OWNER_PASSWORD}'`);
  await admin.query('CREATE DATABASE m4b OWNER m4b_owner');
  const owner = new URL(container.getConnectionUri());
  owner.username = 'm4b_owner';
  owner.password = OWNER_PASSWORD;
  owner.pathname = '/m4b';
  ownerUrl = owner.toString();
  await admin.end();

  // The runner, as the non-superuser owner: the same path a deployment takes, including the roles and pg-boss schema.
  await runMigration();
  const seed = new Client({ connectionString: databaseUrl(container.getConnectionUri(), 'm4b') });
  await seed.connect();
  await seed.query(SEED);
  await seed.end();

  db = new Client({ connectionString: ownerUrl });
  await db.connect();
  await db.query('SET ROLE app_user');
}, 180_000);

afterAll(async () => {
  await db?.end();
  await container?.stop();
});

describe('asset register', () => {
  it('refuses a row with no kind and each of the four kinds inserts', async () => {
    await asPlant(A);
    await expect(
      db.query(
        "INSERT INTO asset_register (tenant_id) VALUES (current_setting('app.tenant_id')::uuid)",
      ),
    ).rejects.toThrow(/kind/);
    for (const kind of ['amc', 'warranty', 'legal', 'calibration']) {
      await db.query(
        `INSERT INTO asset_register (id, tenant_id, kind, machine_id, due_on)
         VALUES ($1, current_setting('app.tenant_id')::uuid, $2, $3, current_date)`,
        [randomUUID(), kind, MACHINE_A],
      );
    }
    expect(await count('asset_register')).toBeGreaterThanOrEqual(5);
  });

  it('refuses a negative lead time and a contract that ends before it starts', async () => {
    await asPlant(A);
    const insert = (lead: number, starts: string, ends: string) =>
      db.query(
        `INSERT INTO asset_register (tenant_id, kind, starts_on, ends_on, lead_days)
         VALUES (current_setting('app.tenant_id')::uuid, 'amc', $1, $2, $3)`,
        [starts, ends, lead],
      );
    await expect(insert(-1, '2026-01-01', '2026-12-31')).rejects.toThrow(/lead_days/);
    await expect(insert(0, '2026-12-31', '2026-01-01')).rejects.toThrow(
      /asset_register_dates_check/,
    );
  });
});

describe('planned ticket channels', () => {
  it('accepts pm and inspection beside whatsapp, and refuses a channel outside the list', async () => {
    await asPlant(A);
    await ticket('pm', 'PM-0001');
    await ticket('inspection', 'INS-0001');
    await ticket('whatsapp', 'WA-0001');
    await expect(ticket('bogus', 'BAD-0001')).rejects.toThrow(/ticket_raised_channel_check/);
  });

  it('arms no clock for a planned ticket', async () => {
    await asPlant(A);
    const id = (await ticket('pm', 'PM-0002')).rows[0].id as string;
    expect(
      (await db.query('SELECT count(*)::int AS n FROM sla_timer WHERE ticket_id = $1', [id]))
        .rows[0].n,
    ).toBe(0);
  });
});

describe('failure codes and the PM report', () => {
  beforeAll(async () => {
    await asPlant(A);
    for (const code of ['BRG', 'WORN', 'MISALIGN', 'REPLACE']) await listItem('failure_code', code);
    await listItem('failure_code', 'OLD', false);
    await asPlant(B);
    await listItem('failure_code', 'BONLY');
    await asPlant(A);
  });

  it('stores the four codes and reads them back', async () => {
    await asPlant(A);
    await report({
      problem: 'Coded report',
      component: 'BRG',
      mode: 'WORN',
      cause: 'MISALIGN',
      action: 'REPLACE',
    });
    const row = (
      await db.query(
        `SELECT failure_component, failure_mode, failure_cause, failure_action
         FROM breakdown_report WHERE problem = 'Coded report'`,
      )
    ).rows[0];
    expect(row).toEqual({
      failure_component: 'BRG',
      failure_mode: 'WORN',
      failure_cause: 'MISALIGN',
      failure_action: 'REPLACE',
    });
  });

  it('refuses a code that is not in this plant’s list, including another plant’s code', async () => {
    await asPlant(A);
    await expect(report({ problem: 'Bad code', component: 'NOPE' })).rejects.toThrow(
      /not a failure code of this plant/,
    );
    await expect(report({ problem: 'Other tenant code', mode: 'BONLY' })).rejects.toThrow(
      /not a failure code of this plant/,
    );
  });

  it('still accepts a code that was switched off after old reports used it', async () => {
    await asPlant(A);
    await report({ problem: 'Old code', cause: 'OLD' });
    expect(
      (await db.query("SELECT 1 FROM breakdown_report WHERE problem = 'Old code'")).rowCount,
    ).toBe(1);
  });

  it('round-trips pm_report and leaves every other report’s pm_report NULL', async () => {
    await asPlant(A);
    const pmReport = {
      total: 4,
      undone: ['grease the guide'],
      readings: { meter: 1200 },
      comments: 'Done after shift',
      doneBy: ['10000000-0000-0000-0000-000000000002'],
    };
    await report({ problem: 'PM job report', pm: pmReport });
    expect(
      (await db.query("SELECT pm_report FROM breakdown_report WHERE problem = 'PM job report'"))
        .rows[0].pm_report,
    ).toEqual(pmReport);
    expect(
      (
        await db.query('SELECT pm_report FROM breakdown_report WHERE id = $1', [
          '10000000-0000-0000-0000-000000000012',
        ])
      ).rows[0].pm_report,
    ).toBeNull();
  });
});

describe('PM plans, forecasts and interventions', () => {
  it('keeps the meter fields on a PM plan and refuses a plan with neither machine nor category', async () => {
    await asPlant(A);
    await db.query(
      `INSERT INTO pm_plan (tenant_id, machine_id, title, interval_days, meter_interval,
         meter_tolerance, last_meter_reading)
       VALUES (current_setting('app.tenant_id')::uuid, $1, 'Meter plan', 30, 500, 5, 1200)`,
      [MACHINE_A],
    );
    const plan = (
      await db.query(
        `SELECT interval_days, meter_interval::text AS meter_interval,
                meter_tolerance::text AS meter_tolerance, last_meter_reading::text AS last_meter_reading
         FROM pm_plan WHERE title = 'Meter plan'`,
      )
    ).rows[0];
    expect(plan).toEqual({
      interval_days: 30,
      meter_interval: '500',
      meter_tolerance: '5',
      last_meter_reading: '1200',
    });
    await expect(
      db.query(
        "INSERT INTO pm_plan (tenant_id, title) VALUES (current_setting('app.tenant_id')::uuid, 'No target')",
      ),
    ).rejects.toThrow(/pm_plan_target_check/);
  });

  it('refuses a second forecast for the same machine and month', async () => {
    await asPlant(A);
    await expect(
      db.query(
        `INSERT INTO forecast (tenant_id, machine_id, month, as_of, profile, model, predicted)
         VALUES (current_setting('app.tenant_id')::uuid, $1, '2026-12-01', '2026-11-14', 'legacy', 'again', '{}')`,
        [MACHINE_A],
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it('lets the app write the outcome but never rewrite the prediction', async () => {
    await asPlant(A);
    await expect(
      db.query(
        "UPDATE forecast SET predicted = '{}' WHERE tenant_id = current_setting('app.tenant_id')::uuid",
      ),
    ).rejects.toThrow(/permission denied/);
    await db.query(
      `UPDATE forecast SET outcome = '{"hours": 3.5}', scored_at = now()
       WHERE id = $1 AND tenant_id = current_setting('app.tenant_id')::uuid`,
      [FORECAST_A],
    );
    expect(
      (await db.query('SELECT outcome FROM forecast WHERE id = $1', [FORECAST_A])).rows[0].outcome,
    ).toEqual({ hours: 3.5 });
  });

  it('refuses an intervention with no target and one pointing at another plant’s plan', async () => {
    await asPlant(A);
    await expect(
      db.query(
        "INSERT INTO intervention (tenant_id, changed_on) VALUES (current_setting('app.tenant_id')::uuid, current_date)",
      ),
    ).rejects.toThrow(/intervention_target_check/);
    await expect(
      db.query(
        `INSERT INTO intervention (tenant_id, pm_plan_id, changed_on)
         VALUES (current_setting('app.tenant_id')::uuid, $1, current_date)`,
        [PM_PLAN_B],
      ),
    ).rejects.toThrow(/foreign key/);
  });
});

describe('cross-tenant invisibility', () => {
  it('shows each plant only its own row in the four M4b tables', async () => {
    await asPlant(B);
    for (const table of ['forecast', 'intervention', 'pm_plan', 'asset_register']) {
      expect(await count(table), `${table} as ${B}`).toBe(1);
    }
    await asPlant(A);
    for (const [table, id] of [
      ['forecast', '20000000-0000-0000-0000-000000000024'],
      ['intervention', '20000000-0000-0000-0000-000000000026'],
      ['pm_plan', PM_PLAN_B],
      ['asset_register', '20000000-0000-0000-0000-000000000027'],
    ] as const) {
      expect((await db.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id])).rowCount, table).toBe(
        0,
      );
    }
  });
});

describe('the revert', () => {
  it('refuses while a pm ticket exists, applies after it is gone, and the runner re-applies it', async () => {
    await asPlant(A);
    await db.query(
      "UPDATE ticket SET raised_channel = 'floor' WHERE raised_channel IN ('pm', 'inspection')",
    );
    await ticket('pm', 'PM-DOWN');
    await db.query('RESET ROLE');
    await expect(db.query(DOWN)).rejects.toThrow(/Revert stopped: .*Restore the snapshot instead/);
    await db.query('ROLLBACK');
    await db.query('SET ROLE app_user');
    await asPlant(A);
    await db.query("UPDATE ticket SET raised_channel = 'floor' WHERE ref = 'PM-DOWN'");
    await db.query('RESET ROLE');

    await db.query(DOWN);
    const gone = await db.query(
      `SELECT to_regclass('public.forecast') IS NULL AND to_regclass('public.intervention') IS NULL
         AND to_regclass('public.pm_plan') IS NULL AND to_regclass('public.asset_register') IS NULL
         AND to_regprocedure('breakdown_report_check_failure_codes()') IS NULL
         AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'breakdown_report_failure_codes')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_name = 'breakdown_report'
                           AND column_name IN ('failure_component', 'failure_mode', 'failure_cause',
                                               'failure_action', 'pm_report')) AS gone`,
    );
    expect(gone.rows[0].gone).toBe(true);
    expect(
      (await db.query("SELECT relforcerowsecurity FROM pg_class WHERE relname = 'ticket'")).rows[0]
        .relforcerowsecurity,
    ).toBe(true);

    await db.query('SET ROLE app_user');
    await asPlant(A);
    await expect(ticket('pm', 'PM-OLD')).rejects.toThrow(/ticket_raised_channel_check/);
    await db.query('RESET ROLE');
    const reapplied = await runMigration();
    expect(reapplied.stdout).toContain('applied 0015_m4b_schema.sql');
    expect(
      (
        await db.query(
          `SELECT to_regclass('public.forecast') IS NOT NULL
           AND to_regclass('public.asset_register') IS NOT NULL AS back`,
        )
      ).rows[0].back,
    ).toBe(true);
  });
});
