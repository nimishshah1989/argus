import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { LOGIN_ROLES } from '@uptimo/shared';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

// Ticket 18: record a breakdown that already happened, as a closed ticket, so old reports and figures are complete.
export const TENANT = '20000000-0000-0000-0000-000000000001';
const TENANT_2 = '20000000-0000-0000-0000-000000000002';
const SEGMENT = '20000000-0000-0000-0000-000000000003';
export const OTHER_PERSON = '20000000-0000-0000-0000-000000000004';
const PASSWORD = 'correct-horse-battery';
export const HOST = 'cosmos.localhost';
const MACHINES = 40;
export const machine = (n: number): string =>
  `20000000-0000-0000-0000-0000000001${String(n).padStart(2, '0')}`;
export const person = (n: number): string =>
  `20000000-0000-0000-0000-0000000002${String(n).padStart(2, '0')}`;
export const OTHER_MACHINE = '20000000-0000-0000-0000-000000000300';
/** A time on the plant's day of 10 March 2026, in UTC (the plant is five and a half hours ahead). */
export const at = (hhmm: string): string => `2026-03-10T${hhmm}:00.000Z`;

type App = Awaited<ReturnType<typeof buildApp>>;
export let db: TestDb;
export let admin: Pool;
export let app: App;
export const tokens: Record<string, string> = {};
export let otherToken = '';
export let keyCounter = 0;
export let nextMachine = 0;
export const freshMachine = (): string => machine(++nextMachine);

export function send(opts: {
  url: string;
  token?: string;
  payload?: unknown;
  key?: string | null;
  host?: string;
}) {
  keyCounter += 1;
  const headers: Record<string, string> = {
    host: opts.host ?? HOST,
    'content-type': 'application/json',
  };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.key !== null) headers['idempotency-key'] = opts.key ?? `past-${keyCounter}`;
  return app.inject({ method: 'POST', url: opts.url, headers, payload: opts.payload as object });
}
export const past = (token: string, payload: Record<string, unknown>, key?: string) =>
  send({ url: '/api/v1/tickets/past', token, payload, key });
export const get = (url: string, token: string, host = HOST) =>
  app.inject({ method: 'GET', url, headers: { host, authorization: `Bearer ${token}` } });

/** A past breakdown on `machineId` from `from` to `to` (UTC hours and minutes of 10 March). */
export const span = (
  machineId: string,
  from: string,
  to: string,
  extra: Record<string, unknown> = {},
) => ({
  machineId,
  reportedAt: at(from),
  runningAt: at(to),
  problem: 'Spindle alarm',
  ...extra,
});

export async function login(username: string, host = HOST): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host, 'content-type': 'application/json' },
    payload: { username, password: PASSWORD },
  });
  return res.json().token as string;
}

export async function insertTicket(
  machineId: string,
  fields: { status: string; from: string; to?: string; channel: string },
) {
  await admin.query(
    `INSERT INTO ticket (tenant_id, ref, kind, status, problem, reported_at, closed_at, close_kind, cancelled_at, severity, machine_id, raised_channel)
     VALUES ($1, $2, 'stopped', $3, 'Earlier job', $4, $5, $6, $7, 'S3', $8, $9)`,
    [
      TENANT,
      `BD-${9000 + ++keyCounter}`,
      fields.status,
      at(fields.from),
      fields.to ? at(fields.to) : null,
      fields.status === 'closed' ? 'report' : null,
      fields.status === 'cancelled' ? at(fields.from) : null,
      machineId,
      fields.channel,
    ],
  );
}

export async function startPlant(): Promise<void> {
  db = await startTestDb();
  admin = db.admin;
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query(
    `INSERT INTO tenant (id, slug, name, time_zone) VALUES ($1, 'cosmos', 'Cosmos', 'Asia/Kolkata'), ($2, 'plant-two', 'Plant Two', 'Asia/Kolkata')`,
    [TENANT, TENANT_2],
  );
  await admin.query(
    `INSERT INTO shift (tenant_id, code, name, starts_at, ends_at, crosses_midnight) VALUES
     ($1, '1', 'Shift 1', '08:00', '18:30', false), ($1, '2', 'Shift 2', '18:29', '05:00', true)`,
    [TENANT],
  );
  await admin.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0)",
    [SEGMENT, TENANT],
  );
  for (let n = 1; n <= MACHINES; n += 1) {
    await admin.query(
      "INSERT INTO machine (id, tenant_id, code, segment_id, category, cell, criticality) VALUES ($1, $2, $3, $4, 'VMC', 'Cell-1', 'B')",
      [machine(n), TENANT, `VC-${n}`, SEGMENT],
    );
  }
  await admin.query(
    "INSERT INTO segment (tenant_id, code, name, sort) VALUES ($1, 'CNC', 'CNC', 0)",
    [TENANT_2],
  );
  await admin.query(
    "INSERT INTO machine (id, tenant_id, code, category, cell) SELECT $1, $2, 'XX-1', 'VMC', 'Cell-1'",
    [OTHER_MACHINE, TENANT_2],
  );
  // One person and login per role, plus a plant-two person.
  for (const [index, role] of LOGIN_ROLES.entries()) {
    await admin.query(
      "INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $2, $3, 'maintenance', 'Staff')",
      [person(index), TENANT, `Test ${role}`],
    );
    await admin.query(
      'INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, $4, $5, false)',
      [TENANT, person(index), role, passwordHash, role],
    );
  }
  await admin.query(
    "INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $2, 'Other Plant', 'maintenance', 'Staff')",
    [OTHER_PERSON, TENANT_2],
  );
  await admin.query(
    "INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, 'other', $3, 'technician', false)",
    [TENANT_2, OTHER_PERSON, passwordHash],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  for (const role of LOGIN_ROLES) tokens[role] = await login(role);
  otherToken = await login('other', 'plant-two.localhost');
}

export async function stopPlant(): Promise<void> {
  await app.close();
  await db.stop();
}

export const tech = () => tokens.technician as string;
export const adminToken = () => tokens.admin as string;
