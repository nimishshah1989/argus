import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { importBhavin } from '../src/import/bhavin.js';
import { hashToken } from '../src/session.js';
import {
  makeOrdinaryTicket,
  makeSyntheticExport,
  seedSyntheticTenant,
  syntheticIds,
} from './import-fixture.js';
import { startTestDb, type TestDb } from './harness.js';

type RawTicket = Record<string, unknown>;
type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let app: App;
let technicianToken = '';
let adminToken = '';
let adminPerson = '';

function minutes(start: string, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - new Date(start).getTime()) / 60_000));
}

function liveTicket(
  kind: 'open' | 'working' | 'waiting' | 'running' | 'cancelled' | 'noReport',
): RawTicket {
  const now = new Date();
  const base = makeOrdinaryTicket({ legacyId: `live-${kind}`, ref: 'BD-0100' });
  const state = {
    ...base.state,
    startedAt: null,
    segmentStartedAt: null,
    leadPerson: null,
    closedAt: null,
    closedByPerson: null,
    closeKind: null,
    closeNote: null,
    cancelledAt: null,
  };
  const downAccMin = minutes('2026-11-01T10:00:00Z', now);
  const activeMin = minutes('2026-11-01T10:05:00Z', now);
  const waitMin = minutes('2026-11-01T10:30:00Z', now);
  const baseFigures = {
    ...base.storedFigures,
    activeMin,
    downAccMin,
    downtimeMin: null,
    repairMin: activeMin,
  };
  if (kind === 'open') {
    return {
      ...base,
      status: 'open',
      events: [base.events[0]],
      crew: [],
      segments: [],
      reports: [],
      state,
      storedFigures: { ...baseFigures, activeMin: 0, responseMin: null, repairMin: 0 },
    } as RawTicket;
  }
  const working = {
    ...state,
    startedAt: '2026-11-01T10:05:00Z',
    segmentStartedAt: '2026-11-01T10:05:00Z',
    leadPerson: 'SYNTH-LEAD',
  };
  if (kind === 'working') {
    return {
      ...base,
      status: 'working',
      events: base.events.slice(0, 2),
      crew: [base.crew[0]],
      segments: [{ ...base.segments[0], endedAt: null, endReason: null }],
      reports: [],
      state: working,
      storedFigures: baseFigures,
    } as RawTicket;
  }
  if (kind === 'waiting') {
    return {
      ...base,
      status: 'waiting',
      events: [
        base.events[0],
        base.events[1],
        {
          at: '2026-11-01T10:30:00Z',
          by: 'SYNTH-LEAD',
          payload: { reason: 'spare', assignTo: null, expectedBackAt: null, isVendor: true },
          text: null,
          type: 'pause',
        },
      ],
      crew: [base.crew[0]],
      segments: [{ ...base.segments[0], endedAt: '2026-11-01T10:30:00Z', endReason: 'pause' }],
      reports: [],
      state: {
        ...working,
        waitReason: 'spare',
        waitSince: '2026-11-01T10:30:00Z',
        pausedByPerson: 'SYNTH-LEAD',
      },
      storedFigures: { ...baseFigures, activeMin: 25, repairMin: 25, waitMin, vendorMin: waitMin },
    } as RawTicket;
  }
  if (kind === 'running') {
    return {
      ...base,
      status: 'working',
      events: [
        base.events[0],
        base.events[1],
        { at: '2026-11-01T10:45:00Z', by: 'SYNTH-LEAD', payload: {}, text: null, type: 'running' },
      ],
      crew: [base.crew[0]],
      segments: [{ ...base.segments[0], endedAt: null, endReason: null }],
      reports: [],
      state: { ...working, machineRunningAt: '2026-11-01T10:45:00Z' },
      storedFigures: { ...baseFigures, downAccMin: 45 },
    } as RawTicket;
  }
  if (kind === 'cancelled') {
    return {
      ...base,
      status: 'cancelled',
      events: [
        base.events[0],
        base.events[1],
        {
          at: '2026-11-01T10:30:00Z',
          by: 'SYNTH-LEAD',
          payload: { previousStatus: 'working' },
          text: 'Synthetic cancel',
          type: 'cancel',
        },
      ],
      crew: [base.crew[0]],
      segments: [{ ...base.segments[0], endedAt: '2026-11-01T10:30:00Z', endReason: 'cancel' }],
      reports: [],
      state: { ...working, cancelledAt: '2026-11-01T10:30:00Z' },
      storedFigures: { ...baseFigures, activeMin: 25, downAccMin: 30, repairMin: 25 },
    } as RawTicket;
  }
  return {
    ...base,
    events: [
      base.events[0],
      base.events[1],
      { ...base.events[3], payload: { kind: 'no_report' }, text: 'Synthetic no report' },
    ],
    crew: [base.crew[0]],
    segments: [base.segments[0]],
    reports: [],
    state: {
      ...working,
      closedAt: '2026-11-01T11:00:00Z',
      closedByPerson: 'SYNTH-LEAD',
      closeKind: 'no_report',
      closeNote: 'Synthetic no report',
    },
    storedFigures: { ...base.storedFigures },
  } as RawTicket;
}

beforeAll(async () => {
  db = await startTestDb();
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
}, 120_000);

beforeEach(async () => {
  await db.admin.query('DELETE FROM tenant');
  await seedSyntheticTenant(db.admin);
  await db.admin.query("UPDATE tenant SET slug = 'cosmos' WHERE id = $1", [syntheticIds.tenant]);
  adminPerson = randomUUID();
  const technicianLogin = randomUUID();
  const adminLogin = randomUUID();
  await db.admin.query(
    `INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, 'Synthetic Admin', 'maintenance')`,
    [adminPerson, syntheticIds.tenant],
  );
  await db.admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role)
     VALUES ($1, $3, $4, 'tech', 'unused', 'technician'), ($2, $3, $5, 'admin', 'unused', 'admin')`,
    [technicianLogin, adminLogin, syntheticIds.tenant, syntheticIds.asha, adminPerson],
  );
  technicianToken = `tech-${randomUUID()}`;
  adminToken = `admin-${randomUUID()}`;
  await db.admin.query(
    `INSERT INTO session (tenant_id, login_id, token_hash, expires_at, acting_person_id)
     VALUES ($1, $2, $3, now() + interval '1 hour', $4), ($1, $5, $6, now() + interval '1 hour', $7)`,
    [
      syntheticIds.tenant,
      technicianLogin,
      hashToken(technicianToken),
      syntheticIds.asha,
      adminLogin,
      hashToken(adminToken),
      adminPerson,
    ],
  );
});

afterAll(async () => {
  await app.close();
  await db.stop();
});

function post(url: string, token: string, payload: unknown) {
  return app.inject({
    method: 'POST',
    url,
    headers: {
      host: 'cosmos.localhost',
      authorization: `Bearer ${token}`,
      'idempotency-key': randomUUID(),
      'content-type': 'application/json',
    },
    payload: payload as object,
  });
}

async function importLive(kind: Parameters<typeof liveTicket>[0]): Promise<string> {
  await importBhavin(db.app, syntheticIds.tenant, makeSyntheticExport([liveTicket(kind)]));
  const result = await db.admin.query('SELECT id FROM ticket WHERE tenant_id = $1', [
    syntheticIds.tenant,
  ]);
  return result.rows[0].id as string;
}

async function expectSequence(ticketId: string, last: number): Promise<void> {
  const result = await db.admin.query(
    `SELECT last_event_seq, (SELECT count(*)::int FROM ticket_event WHERE ticket_id = $1) AS count,
      (SELECT max(seq) FROM ticket_event WHERE ticket_id = $1) AS max_seq FROM ticket WHERE id = $1`,
    [ticketId],
  );
  expect(result.rows[0]).toMatchObject({ last_event_seq: last, count: last + 1, max_seq: last });
}

describe('post-import command compatibility', () => {
  it('T46 runs start/update/running/stopped/pause/resume/cancel/restore with sequential events', async () => {
    const id = await importLive('open');
    for (const [path, expected] of [
      ['start', 1],
      ['update', 2],
      ['machine-running', 3],
      ['machine-stopped', 4],
      ['pause', 5],
      ['resume', 6],
      ['cancel', 7],
    ] as const) {
      const payload =
        path === 'update'
          ? { personId: syntheticIds.asha, text: 'Synthetic update' }
          : path === 'pause'
            ? { personId: syntheticIds.asha, reasonCode: 'spare' }
            : path === 'cancel'
              ? { personId: syntheticIds.asha, reason: 'Synthetic cancel' }
              : { personId: syntheticIds.asha };
      const response = await post(`/api/v1/tickets/${id}/${path}`, technicianToken, payload);
      expect(response.statusCode, `${path}: ${response.body}`).toBe(200);
      await expectSequence(id, expected);
    }
    const restored = await post(`/api/v1/tickets/${id}/restore`, adminToken, {
      personId: adminPerson,
      reason: 'Synthetic restore',
    });
    expect(restored.statusCode).toBe(200);
    await expectSequence(id, 8);
  });

  it('T46 files a late report after an imported no-report close', async () => {
    const id = await importLive('noReport');
    const response = await post(`/api/v1/tickets/${id}/report`, technicianToken, {
      personId: syntheticIds.asha,
      report: {},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().ticket.closeKind).toBe('report');
    await expectSequence(id, 3);
  });

  it('T47 allocates the next BD ref immediately after import', async () => {
    await importBhavin(db.app, syntheticIds.tenant, makeSyntheticExport());
    const response = await post('/api/v1/tickets', technicianToken, {
      machineId: syntheticIds.machine,
      problem: 'Immediate post-import raise',
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().ticket.ref).toBe('BD-0101');
    await expectSequence(response.json().ticket.id as string, 0);
  });
});
