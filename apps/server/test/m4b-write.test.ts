// Ticket 46b: the write paths the M4b schema allows. A planned raise through the module's published path, the
// HTTP raise refusing planned channels, a close with the four failure codes and a PM report, and the plant's
// pm_plan/asset_register writes behind its interface.
import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { withTenant } from '@uptimo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';
import { raisePlannedTicket } from '../src/modules/tickets/index.js';
import {
  assetRegisterById,
  insertAssetRegister,
  insertPmPlan,
  pmPlanById,
} from '../src/modules/plant/index.js';

const TENANT = '30000000-0000-0000-0000-000000000001';
const SEGMENT = '30000000-0000-0000-0000-000000000002';
const ASHA = '30000000-0000-0000-0000-000000000009';
const PASSWORD = 'correct-horse-battery';
const HOST = 'cosmos.localhost';
const machine = (n: number): string =>
  `30000000-0000-0000-0000-0000000001${String(n).padStart(2, '0')}`;
const MACHINE_HTTP = machine(1);
const MACHINE_PLANNED = machine(2);
const MACHINE_INSPECTION = machine(3);
const MACHINE_WORK = machine(4);
const MACHINE_CLOSE = machine(5);
const MACHINE_PAST = machine(6);

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let admin: Pool;
let app: App;
let token = '';
let keyCounter = 0;

function post(url: string, payload: unknown) {
  keyCounter += 1;
  return app.inject({
    method: 'POST',
    url,
    headers: {
      host: HOST,
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': `m4b-${keyCounter}`,
    },
    payload: payload as object,
  });
}

const get = (url: string) =>
  app.inject({ method: 'GET', url, headers: { host: HOST, authorization: `Bearer ${token}` } });

async function login(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: HOST, 'content-type': 'application/json' },
    payload: { username: 'asha', password: PASSWORD },
  });
  return res.json().token as string;
}

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')", [
    TENANT,
  ]);
  await admin.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0)",
    [SEGMENT, TENANT],
  );
  for (const [index, id] of [
    MACHINE_HTTP,
    MACHINE_PLANNED,
    MACHINE_INSPECTION,
    MACHINE_WORK,
    MACHINE_CLOSE,
    MACHINE_PAST,
  ].entries()) {
    await admin.query(
      "INSERT INTO machine (id, tenant_id, code, segment_id, category, cell, criticality) VALUES ($1, $2, $3, $4, 'VMC', 'Cell-1', 'B')",
      [id, TENANT, `VC-${index + 2}`, SEGMENT],
    );
  }
  await admin.query(
    "INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $2, 'Asha', 'maintenance', 'Technician')",
    [ASHA, TENANT],
  );
  await admin.query(
    "INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, 'asha', $3, 'technician', false)",
    [TENANT, ASHA, passwordHash],
  );
  // The list is the plant's data (ticket 47 seeds it); 46b only proves the database refuses what is not on it.
  await admin.query(
    `INSERT INTO list_item (tenant_id, list, code, label) VALUES
       ($1, 'failure_code', 'BRG', 'Bearing'), ($1, 'failure_code', 'WORN', 'Worn'),
       ($1, 'failure_code', 'MISALIGN', 'Misaligned'), ($1, 'failure_code', 'REPLACE', 'Replace')`,
    [TENANT],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  token = await login();
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('a planned raise through the published path', () => {
  it.each([
    ['pm', MACHINE_PLANNED],
    ['inspection', MACHINE_INSPECTION],
  ])('lands with channel %s', async (channel, machineId) => {
    const raised = await withTenant(db.app, TENANT, (client) =>
      raisePlannedTicket(client, {
        tenantId: TENANT,
        machineId,
        channel: channel as 'pm' | 'inspection',
        problem: 'Planned service',
      }),
    );
    const detail = await get(`/api/v1/tickets/${raised.id}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json().ticket).toMatchObject({
      id: raised.id,
      ref: raised.ref,
      raisedChannel: channel,
      status: 'open',
    });
  });
});

describe('the HTTP raise path', () => {
  it('refuses a planned channel from a person and keeps floor', async () => {
    const refused = await post('/api/v1/tickets', {
      machineId: MACHINE_HTTP,
      problem: 'Spindle alarm',
      channel: 'pm',
    });
    expect(refused.statusCode).toBe(422);
    expect(refused.json().error.code).toBe('validation');

    const unknown = await post('/api/v1/tickets', {
      machineId: MACHINE_HTTP,
      problem: 'Spindle alarm',
      channel: 'bogus',
    });
    expect(unknown.statusCode).toBe(422);

    const floor = await post('/api/v1/tickets', {
      machineId: MACHINE_HTTP,
      problem: 'Spindle alarm',
      channel: 'floor',
    });
    expect(floor.statusCode).toBe(201);
    expect(floor.json().ticket.raisedChannel).toBe('floor');
  });
});

describe('a breakdown report with failure codes and a PM report', () => {
  it('round-trips the four codes and the ticked PM job', async () => {
    const raised = await withTenant(db.app, TENANT, (client) =>
      raisePlannedTicket(client, {
        tenantId: TENANT,
        machineId: MACHINE_CLOSE,
        channel: 'pm',
        problem: 'Planned service',
      }),
    );
    const started = await post(`/api/v1/tickets/${raised.id}/start`, { personId: ASHA });
    expect(started.statusCode).toBe(200);
    const closed = await post(`/api/v1/tickets/${raised.id}/close`, {
      personId: ASHA,
      kind: 'report',
      report: {
        problem: 'Planned service',
        correctiveAction: 'Replaced the bearing',
        failureComponent: 'BRG',
        failureMode: 'WORN',
        failureCause: 'MISALIGN',
        failureAction: 'REPLACE',
        pmReport: {
          total: 3,
          undone: ['belt tension'],
          readings: { hours: 500 },
          comments: 'Bearing noise',
          doneBy: ASHA,
        },
      },
    });
    expect(closed.statusCode).toBe(200);
    const report = (await get(`/api/v1/tickets/${raised.id}`)).json().report;
    expect(report).toMatchObject({
      failureComponent: 'BRG',
      failureMode: 'WORN',
      failureCause: 'MISALIGN',
      failureAction: 'REPLACE',
      pmReport: {
        total: 3,
        undone: ['belt tension'],
        readings: { hours: 500 },
        comments: 'Bearing noise',
        doneBy: ASHA,
      },
    });
  });

  it('refuses a code that is not on the plant list, and the close rolls back', async () => {
    const raised = await post('/api/v1/tickets', {
      machineId: MACHINE_WORK,
      problem: 'Spindle alarm',
      startNow: true,
    });
    const id = raised.json().ticket.id as string;
    const refused = await post(`/api/v1/tickets/${id}/close`, {
      personId: ASHA,
      kind: 'report',
      report: { failureComponent: 'NOT-A-CODE' },
    });
    expect(refused.statusCode).toBe(422);
    expect(refused.json().error.field).toBe('failureComponent');
    expect((await get(`/api/v1/tickets/${id}`)).json().ticket.status).toBe('working');
  });

  it('carries the codes and the PM report through a past breakdown', async () => {
    const recorded = await post('/api/v1/tickets/past', {
      machineId: MACHINE_PAST,
      reportedAt: '2026-03-10T04:00:00.000Z',
      runningAt: '2026-03-10T05:00:00.000Z',
      problem: 'Spindle alarm',
      report: {
        shiftCode: '1',
        failureComponent: 'BRG',
        failureMode: 'WORN',
        pmReport: { total: 1, readings: { hours: 12 } },
      },
    });
    expect(recorded.statusCode).toBe(201);
    const report = (await get(`/api/v1/tickets/${recorded.json().ticket.id}`)).json().report;
    expect(report).toMatchObject({
      failureComponent: 'BRG',
      failureMode: 'WORN',
      pmReport: { total: 1, readings: { hours: 12 } },
    });
  });
});

describe("the plant module's published writes", () => {
  it('writes and reads one pm_plan draft', async () => {
    const draft = await withTenant(db.app, TENANT, (client) =>
      insertPmPlan(client, TENANT, {
        machineId: MACHINE_INSPECTION,
        title: '500-hour service',
        intervalDays: 30,
        meterInterval: 500,
        meterTolerance: 10,
        lastMeterReading: 1200,
        checklist: ['oil', 'filter'],
      }),
    );
    const read = await withTenant(db.app, TENANT, (client) => pmPlanById(client, TENANT, draft.id));
    expect(read).toMatchObject({
      id: draft.id,
      machineId: MACHINE_INSPECTION,
      title: '500-hour service',
      intervalDays: 30,
      meterInterval: 500,
      meterTolerance: 10,
      lastMeterReading: 1200,
      checklist: ['oil', 'filter'],
      active: true,
    });
  });

  it('writes and reads one asset_register row', async () => {
    const asset = await withTenant(db.app, TENANT, (client) =>
      insertAssetRegister(client, TENANT, {
        kind: 'amc',
        machineId: MACHINE_HTTP,
        vendor: 'Acme',
        reference: 'AMC-1',
        startsOn: '2026-01-01',
        endsOn: '2027-01-01',
        dueOn: '2026-12-01',
        leadDays: 30,
        notes: 'Annual cover',
      }),
    );
    const read = await withTenant(db.app, TENANT, (client) =>
      assetRegisterById(client, TENANT, asset.id),
    );
    expect(read).toMatchObject({
      id: asset.id,
      kind: 'amc',
      machineId: MACHINE_HTTP,
      vendor: 'Acme',
      reference: 'AMC-1',
      startsOn: '2026-01-01',
      endsOn: '2027-01-01',
      dueOn: '2026-12-01',
      leadDays: 30,
      notes: 'Annual cover',
    });
  });
});
