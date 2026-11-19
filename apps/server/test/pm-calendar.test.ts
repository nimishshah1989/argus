// Ticket 50a: the calendar API and the move. Reads are each machine's effective plan next due or its open PM
// ticket (R2); a move materialises or moves the ticket's `task_expected_on`, never the plan row (R3); the window
// is the plan's tolerance, Monday–Saturday and never past (R4); a day already holding a PM is a 409 (R5); the
// write is idempotent and tenant-scoped (R10).
import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '10000000-0000-4000-8000-000000000001';
const TENANT_B = '20000000-0000-4000-8000-000000000001';
const A = (n: number): string => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const B = (n: number): string => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const PASSWORD = 'correct-horse-battery';
const DAY = 86_400_000;

const addDays = (day: string, n: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const dow = (day: string): number => new Date(`${day}T00:00:00Z`).getUTCDay();
/** `n` days after `day`, rolled forward off a Sunday (R4's Monday–Saturday rule). */
const working = (day: string, n: number): string => {
  let out = addDays(day, n);
  while (dow(out) === 0) out = addDays(out, 1);
  return out;
};

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;
interface Item {
  planId: string | null;
  machineId: string;
  machineCode: string;
  title: string;
  dueOn: string;
  scheduledOn: string;
  toleranceDays: number;
  ticketId: string | null;
  status: string;
  movable: boolean;
  crowded: boolean;
  suggestedOn: string | null;
}

let db: TestDb;
let admin: Pool;
let app: App;
let headToken = '';
let techToken = '';
let headBToken = '';

let keyCounter = 0;
const nextKey = (): string => `pm-${(keyCounter += 1)}`;

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const DUE_LONG = addDays(TODAY, -20);
const DUE_SHORT = addDays(TODAY, -2);
const CROWD = working(TODAY, 2);
const MOVE_TO = working(TODAY, 4);
const TICKET_TO = working(TODAY, 8);
const TICKET_7_DAY = addDays(TODAY, 20);
const RANGE_FROM = addDays(TODAY, -40);
const RANGE_TO = addDays(TODAY, 40);
const NEXT_SUNDAY = addDays(TODAY, (7 - dow(TODAY)) % 7 || 7);

const planIds = {
  plan1: '',
  plan2: '',
  plan3: '',
  planCat: '',
  plan7: '',
  plan8: '',
  plan9: '',
  planCrowdA: '',
  planCrowdB: '',
  planMove: '',
  planMoveTicket: '',
  planStarted: '',
  planB: '',
};
const tickets = { ticket7: '', ticket8: '', ticketMove: '', ticketStarted: '' };
let planMoveCreatedAt: Date;
let planMoveLastDone: string;
let ticketMoveReportedAt: Date;

const M = (n: number) => A(n);

async function plan(
  tenantId: string,
  fields: {
    machineId?: string | null;
    category?: string | null;
    title: string;
    lastDoneOn?: string | null;
    intervalDays?: number | null;
    active?: boolean;
  },
): Promise<string> {
  const row = await admin.query(
    `INSERT INTO pm_plan (tenant_id, machine_id, category, title, interval_days, last_done_on, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      tenantId,
      fields.machineId ?? null,
      fields.category ?? null,
      fields.title,
      fields.intervalDays === undefined ? 182 : fields.intervalDays,
      fields.lastDoneOn ?? null,
      fields.active ?? true,
    ],
  );
  return row.rows[0].id as string;
}

async function pmTicket(
  tenantId: string,
  fields: {
    machineId: string;
    ref: string;
    problem: string;
    reportedAt: string;
    scheduledOn?: string | null;
    status?: string;
    startedAt?: string | null;
  },
): Promise<string> {
  const row = await admin.query(
    `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, severity,
       raised_channel, task_expected_on, started_at)
     VALUES ($1,$2,'general',$3,$4,$5,$6,'S3','pm',$7,$8) RETURNING id`,
    [
      tenantId,
      fields.ref,
      fields.status ?? 'open',
      fields.machineId,
      fields.problem,
      fields.reportedAt,
      fields.scheduledOn ?? null,
      fields.startedAt ?? null,
    ],
  );
  return row.rows[0].id as string;
}

async function login(username: string, host = 'cosmos.localhost'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host, 'content-type': 'application/json' },
    payload: { username, password: PASSWORD },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().token as string;
}

function post(
  url: string,
  token: string,
  payload: unknown,
  idem: string | null = nextKey(),
): Promise<Res> {
  const headers: Record<string, string> = {
    host: 'cosmos.localhost',
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };
  if (idem !== null) headers['idempotency-key'] = idem;
  return app.inject({ method: 'POST', url, headers, payload: payload as object });
}

function get(url: string, token: string, host = 'cosmos.localhost'): Promise<Res> {
  return app.inject({
    method: 'GET',
    url,
    headers: { host, authorization: `Bearer ${token}` },
  });
}

const calendar = async (token = headToken, host = 'cosmos.localhost'): Promise<Item[]> => {
  const res = await get(`/api/v1/pm/calendar?from=${RANGE_FROM}&to=${RANGE_TO}`, token, host);
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { items: Item[] }).items;
};

const one = (items: Item[], code: string): Item[] =>
  items.filter((item) => item.machineCode === code);

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
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'plant-two', 'Plant Two')", [
    TENANT_B,
  ]);

  const machines: Array<[string, string, string, string, string]> = [
    // [tenant, id, code, category, status]
    [TENANT, M(10), 'VC-1', 'VMC', 'active'],
    [TENANT, M(11), 'VC-2', 'VMC', 'active'],
    [TENANT, M(12), 'VC-3', 'VMC', 'active'],
    [TENANT, M(13), 'VC-4', 'HMC', 'active'],
    [TENANT, M(14), 'VC-5', 'HMC', 'active'],
    [TENANT, M(15), 'VC-6', 'HMC', 'scrapped'],
    [TENANT, M(16), 'VC-7', 'VMC', 'active'],
    [TENANT, M(17), 'VC-8', 'VMC', 'active'],
    [TENANT, M(18), 'VC-9', 'VMC', 'active'],
    [TENANT, M(19), 'VC-10', 'VMC', 'active'],
    [TENANT, M(20), 'VC-11', 'VMC', 'active'],
    [TENANT, M(21), 'VC-MOVE', 'VMC', 'active'],
    [TENANT, M(22), 'VC-MOVET', 'VMC', 'active'],
    [TENANT, M(23), 'VC-STARTED', 'VMC', 'active'],
    [TENANT_B, B(10), 'VC-B', 'VMC', 'active'],
  ];
  for (const [tenantId, id, code, category, status] of machines)
    await admin.query(
      `INSERT INTO machine (id, tenant_id, code, category, criticality, status)
       VALUES ($1,$2,$3,$4,'B',$5)`,
      [id, tenantId, code, category, status],
    );

  await admin.query(
    `INSERT INTO person (id, tenant_id, name, team, title) VALUES
     ($1,$5,'Head','maintenance','Head'), ($2,$5,'Tech','maintenance','Technician'),
     ($3,$5,'Admin','maintenance','Admin'), ($4,$6,'B Head','maintenance','Head')`,
    [A(30), A(31), A(32), B(30), TENANT, TENANT_B],
  );
  await admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
     ($1,$7,$5,'head',$9,'head',false), ($2,$7,$6,'tech',$9,'technician',false),
     ($3,$7,$8,'admin',$9,'admin',false), ($4,$10,$11,'bhead',$9,'head',false)`,
    [A(40), A(41), A(42), B(40), A(30), A(31), TENANT, A(32), passwordHash, TENANT_B, B(30)],
  );

  // A long-interval plan due 20 days ago, a short one due 2 days ago, and a plan with no interval.
  planIds.plan1 = await plan(TENANT, {
    machineId: M(10),
    title: 'VC-1 preventive maintenance',
    lastDoneOn: addDays(DUE_LONG, -182),
  });
  planIds.plan2 = await plan(TENANT, {
    machineId: M(11),
    title: 'VC-2 preventive maintenance',
    lastDoneOn: addDays(DUE_SHORT, -30),
    intervalDays: 30,
  });
  planIds.plan3 = await plan(TENANT, {
    machineId: M(12),
    title: 'VC-3 no interval',
    lastDoneOn: addDays(DUE_LONG, -182),
    intervalDays: null,
  });
  // One category plan covering two active HMC machines; a scrapped HMC machine gets nothing.
  planIds.planCat = await plan(TENANT, {
    category: 'HMC',
    title: 'HMC category plan',
    lastDoneOn: addDays(DUE_LONG, -182),
  });
  // Two machines with an open PM ticket: one moved to a future scheduled date, one with no date at all.
  planIds.plan7 = await plan(TENANT, {
    machineId: M(16),
    title: 'VC-7 preventive maintenance',
    lastDoneOn: addDays(DUE_LONG, -182),
  });
  planIds.plan8 = await plan(TENANT, {
    machineId: M(17),
    title: 'VC-8 preventive maintenance',
    lastDoneOn: addDays(DUE_LONG, -182),
  });
  planIds.plan9 = await plan(TENANT, {
    machineId: M(18),
    title: 'VC-9 preventive maintenance',
    lastDoneOn: addDays(DUE_LONG, -182),
  });
  tickets.ticket7 = await pmTicket(TENANT, {
    machineId: M(16),
    ref: 'WR-7001',
    problem: 'PM due: VC-7 preventive maintenance',
    reportedAt: `${addDays(TODAY, -10)}T06:00:00Z`,
    scheduledOn: TICKET_7_DAY,
  });
  tickets.ticket8 = await pmTicket(TENANT, {
    machineId: M(17),
    ref: 'WR-8001',
    problem: 'PM due: VC-8 preventive maintenance',
    reportedAt: `${addDays(TODAY, -3)}T06:00:00Z`,
  });
  // A crowded pair on one day, inside the tolerance and with a free day after it.
  planIds.planCrowdA = await plan(TENANT, {
    machineId: M(19),
    title: 'VC-10 preventive maintenance',
    lastDoneOn: addDays(CROWD, -182),
  });
  planIds.planCrowdB = await plan(TENANT, {
    machineId: M(20),
    title: 'VC-11 preventive maintenance',
    lastDoneOn: addDays(CROWD, -182),
  });
  // A plan due today with no ticket (materialised by the move), one with a ticket (moved), one already started.
  planMoveLastDone = addDays(TODAY, -182);
  planIds.planMove = await plan(TENANT, {
    machineId: M(21),
    title: 'VC-MOVE preventive maintenance',
    lastDoneOn: planMoveLastDone,
  });
  planIds.planMoveTicket = await plan(TENANT, {
    machineId: M(22),
    title: 'VC-MOVET preventive maintenance',
    lastDoneOn: addDays(TODAY, -182),
  });
  planIds.planStarted = await plan(TENANT, {
    machineId: M(23),
    title: 'VC-STARTED preventive maintenance',
    lastDoneOn: addDays(TODAY, -182),
  });
  tickets.ticketMove = await pmTicket(TENANT, {
    machineId: M(22),
    ref: 'WR-2201',
    problem: 'PM due: VC-MOVET preventive maintenance',
    reportedAt: `${addDays(TODAY, -1)}T06:00:00Z`,
    scheduledOn: TODAY,
  });
  tickets.ticketStarted = await pmTicket(TENANT, {
    machineId: M(23),
    ref: 'WR-2301',
    problem: 'PM due: VC-STARTED preventive maintenance',
    reportedAt: `${TODAY}T06:00:00Z`,
    scheduledOn: TODAY,
    status: 'working',
    startedAt: `${TODAY}T06:00:00Z`,
  });
  planIds.planB = await plan(TENANT_B, {
    machineId: B(10),
    title: 'VC-B preventive maintenance',
    lastDoneOn: addDays(DUE_LONG, -182),
  });

  planMoveCreatedAt = (
    await admin.query('SELECT created_at FROM pm_plan WHERE id = $1', [planIds.planMove])
  ).rows[0].created_at as Date;
  ticketMoveReportedAt = (
    await admin.query('SELECT reported_at FROM ticket WHERE id = $1', [tickets.ticketMove])
  ).rows[0].reported_at as Date;

  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  headToken = await login('head');
  techToken = await login('tech');
  headBToken = await login('bhead', 'plant-two.localhost');
}, 180_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('GET /api/v1/pm/calendar (R2)', () => {
  it('returns one planned occurrence per machine, at its next due, with the scaled tolerance', async () => {
    const items = await calendar();
    expect(one(items, 'VC-1')).toEqual([
      {
        planId: planIds.plan1,
        machineId: M(10),
        machineCode: 'VC-1',
        title: 'VC-1 preventive maintenance',
        dueOn: DUE_LONG,
        scheduledOn: DUE_LONG,
        toleranceDays: 15,
        ticketId: null,
        status: 'planned',
        movable: true,
        crowded: true,
        suggestedOn: null,
      },
    ]);
    expect(one(items, 'VC-2')).toHaveLength(1);
    expect(one(items, 'VC-2')[0]!.toleranceDays).toBe(2);
    expect(one(items, 'VC-3')).toEqual([]);
  });

  it('lets an open PM ticket replace the plan occurrence, at its scheduled date', async () => {
    const items = await calendar();
    expect(one(items, 'VC-7')).toEqual([
      {
        planId: planIds.plan7,
        machineId: M(16),
        machineCode: 'VC-7',
        title: 'PM due: VC-7 preventive maintenance',
        dueOn: DUE_LONG,
        scheduledOn: TICKET_7_DAY,
        toleranceDays: 15,
        ticketId: tickets.ticket7,
        status: 'open',
        movable: true,
        crowded: false,
        suggestedOn: null,
      },
    ]);
    // No `task_expected_on` reads at the plant day of `reported_at`.
    expect(one(items, 'VC-8')[0]).toMatchObject({
      dueOn: DUE_LONG,
      scheduledOn: addDays(TODAY, -3),
      ticketId: tickets.ticket8,
    });
  });

  it('expands a category plan to each active machine and leaves a scrapped one out', async () => {
    const items = await calendar();
    expect(one(items, 'VC-4')).toHaveLength(1);
    expect(one(items, 'VC-5')).toHaveLength(1);
    expect(one(items, 'VC-4')[0]).toMatchObject({ planId: planIds.planCat, status: 'planned' });
    expect(one(items, 'VC-6')).toEqual([]);
  });

  it('marks a crowded day and suggests a free working day inside the tolerance, never past today', async () => {
    const items = await calendar();
    const crowded = items.filter((item) => item.scheduledOn === CROWD);
    expect(crowded.map((item) => item.machineCode).sort()).toEqual(['VC-10', 'VC-11']);
    for (const item of crowded) {
      expect(item.crowded).toBe(true);
      expect(item.suggestedOn).not.toBeNull();
      expect([1, 2, 3, 4, 5, 6]).toContain(dow(item.suggestedOn!));
      expect(item.suggestedOn! >= TODAY).toBe(true);
      expect(
        Math.abs(Date.parse(item.suggestedOn!) - Date.parse(item.scheduledOn)) / DAY,
      ).toBeLessThanOrEqual(15);
    }
    const lone = one(items, 'VC-2')[0]!;
    expect(lone.crowded).toBe(false);
    expect(lone.suggestedOn).toBeNull();
  });

  it('answers a technician and an anonymous caller with 403 and 401', async () => {
    const forbidden = await get(`/api/v1/pm/calendar?from=${RANGE_FROM}&to=${RANGE_TO}`, techToken);
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe('forbidden');
    const anonymous = await app.inject({
      method: 'GET',
      url: `/api/v1/pm/calendar?from=${RANGE_FROM}&to=${RANGE_TO}`,
      headers: { host: 'cosmos.localhost' },
    });
    expect(anonymous.statusCode).toBe(401);
  });

  it('refuses a bad range with 422 naming the field', async () => {
    const res = await get('/api/v1/pm/calendar?from=2026-02-30&to=2026-03-01', headToken);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('from');
  });
});

describe('POST /api/v1/pm/reschedule materialises a job (R3/R12)', () => {
  it('creates a PM ticket at the target and leaves the plan row alone', async () => {
    const res = await post(
      '/api/v1/pm/reschedule',
      headToken,
      { machineId: M(21), planId: planIds.planMove, ticketId: null, scheduledOn: MOVE_TO },
      'move-1',
    );
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as {
      ticketId: string;
      ref: string;
      scheduledOn: string;
      created: boolean;
    };
    expect(body).toMatchObject({ scheduledOn: MOVE_TO, created: true });
    expect(body.ref).toMatch(/^WR-/);

    const row = (
      await admin.query(
        `SELECT ref, status, raised_channel, parent_id, task_expected_on::text AS task_expected_on,
                reported_at, started_at FROM ticket WHERE id = $1`,
        [body.ticketId],
      )
    ).rows[0];
    expect(row).toMatchObject({
      ref: body.ref,
      status: 'open',
      raised_channel: 'pm',
      parent_id: null,
      task_expected_on: MOVE_TO,
      started_at: null,
    });
    // Reported now, not on the target day.
    expect(Math.abs(Date.now() - new Date(row.reported_at as string).getTime())).toBeLessThan(
      120_000,
    );

    // The plan is untouched: a move never edits the recurrence (R3).
    const planRow = (
      await admin.query(
        'SELECT last_done_on::text AS last_done_on, created_at FROM pm_plan WHERE id = $1',
        [planIds.planMove],
      )
    ).rows[0];
    expect(planRow.last_done_on).toBe(planMoveLastDone);
    expect(new Date(planRow.created_at as Date).toISOString()).toBe(
      planMoveCreatedAt.toISOString(),
    );

    // The raise event carries the scheduled date (R12).
    const events = (
      await admin.query(
        `SELECT type, payload FROM ticket_event WHERE ticket_id = $1 ORDER BY seq`,
        [body.ticketId],
      )
    ).rows;
    expect(events.some((event) => event.payload.scheduledOn === MOVE_TO)).toBe(true);
  });

  it('returns the same ticket for a replay of the same key and body', async () => {
    const body = {
      machineId: M(21),
      planId: planIds.planMove,
      ticketId: null,
      scheduledOn: MOVE_TO,
    };
    const first = await post('/api/v1/pm/reschedule', headToken, body, 'move-1');
    expect(first.statusCode).toBe(200);
    const replayed = await post('/api/v1/pm/reschedule', headToken, body, 'move-1');
    expect(replayed.statusCode).toBe(200);
    expect(replayed.json().ticketId).toBe(first.json().ticketId);
    // The same key with another body is a reused key, not a replay (R3/R10).
    const reused = await post(
      '/api/v1/pm/reschedule',
      headToken,
      { ...body, scheduledOn: TICKET_TO },
      'move-1',
    );
    expect(reused.statusCode).toBe(422);
    expect(reused.json().error.field).toBe('idempotencyKey');
    const count = await admin.query(
      `SELECT count(*)::int AS n FROM ticket
        WHERE tenant_id = $1 AND raised_channel = 'pm' AND machine_id = $2`,
      [TENANT, M(21)],
    );
    expect(count.rows[0].n).toBe(1);
  });

  it('shows the materialised ticket instead of the plan projection', async () => {
    const items = await calendar();
    expect(one(items, 'VC-MOVE')).toEqual([
      {
        planId: planIds.planMove,
        machineId: M(21),
        machineCode: 'VC-MOVE',
        title: 'PM due: VC-MOVE preventive maintenance',
        dueOn: TODAY,
        scheduledOn: MOVE_TO,
        toleranceDays: 15,
        ticketId: expect.any(String),
        status: 'open',
        movable: true,
        crowded: false,
        suggestedOn: null,
      },
    ]);
  });
});

describe('POST /api/v1/pm/reschedule moves an open ticket (R3)', () => {
  it('writes the ticket date and one update event, leaving reported_at and started_at alone', async () => {
    const res = await post('/api/v1/pm/reschedule', headToken, {
      machineId: M(22),
      planId: planIds.planMoveTicket,
      ticketId: tickets.ticketMove,
      scheduledOn: TICKET_TO,
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({
      ticketId: tickets.ticketMove,
      scheduledOn: TICKET_TO,
      created: false,
    });

    const row = (
      await admin.query(
        `SELECT task_expected_on::text AS task_expected_on, reported_at, started_at
           FROM ticket WHERE id = $1`,
        [tickets.ticketMove],
      )
    ).rows[0];
    expect(row.task_expected_on).toBe(TICKET_TO);
    expect(new Date(row.reported_at as Date).toISOString()).toBe(
      ticketMoveReportedAt.toISOString(),
    );
    expect(row.started_at).toBeNull();

    const events = (
      await admin.query(
        `SELECT type, payload FROM ticket_event
          WHERE ticket_id = $1 AND type = 'update' ORDER BY seq`,
        [tickets.ticketMove],
      )
    ).rows;
    expect(events).toHaveLength(1);
    expect(events[0].payload.changes).toEqual([
      { field: 'scheduledOn', from: TODAY, to: TICKET_TO },
    ]);
  });

  it('answers 200 without a second event when the target is the current date', async () => {
    const res = await post('/api/v1/pm/reschedule', headToken, {
      machineId: M(22),
      planId: planIds.planMoveTicket,
      ticketId: tickets.ticketMove,
      scheduledOn: TICKET_TO,
    });
    expect(res.statusCode, res.body).toBe(200);
    const events = await admin.query(
      `SELECT count(*)::int AS n FROM ticket_event WHERE ticket_id = $1 AND type = 'update'`,
      [tickets.ticketMove],
    );
    expect(events.rows[0].n).toBe(1);
  });

  it('refuses a ticket that has started with 409 and writes nothing', async () => {
    const res = await post('/api/v1/pm/reschedule', headToken, {
      machineId: M(23),
      planId: planIds.planStarted,
      ticketId: tickets.ticketStarted,
      scheduledOn: TICKET_TO,
    });
    expect(res.statusCode).toBe(409);
    const row = (
      await admin.query('SELECT task_expected_on::text AS day FROM ticket WHERE id = $1', [
        tickets.ticketStarted,
      ])
    ).rows[0];
    expect(row.day).toBe(TODAY);
  });

  it('refuses a day that already holds a PM with 409 and writes nothing', async () => {
    const res = await post('/api/v1/pm/reschedule', headToken, {
      machineId: M(22),
      planId: planIds.planMoveTicket,
      ticketId: tickets.ticketMove,
      scheduledOn: CROWD,
    });
    expect(res.statusCode).toBe(409);
    const row = (
      await admin.query('SELECT task_expected_on::text AS day FROM ticket WHERE id = $1', [
        tickets.ticketMove,
      ])
    ).rows[0];
    expect(row.day).toBe(TICKET_TO);
  });

  it('refuses a past day, a Sunday, a day outside the tolerance, and a bad body with 422', async () => {
    const outside = addDays(TODAY, 16);
    const bodies: Array<[string, unknown, string]> = [
      ['past', { scheduledOn: addDays(TODAY, -1) }, 'scheduledOn'],
      ['Sunday', { scheduledOn: NEXT_SUNDAY }, 'scheduledOn'],
      ['tolerance', { scheduledOn: outside }, 'scheduledOn'],
      ['missing day', {}, 'scheduledOn'],
    ];
    for (const [label, extra, field] of bodies) {
      const res = await post('/api/v1/pm/reschedule', headToken, {
        machineId: M(22),
        planId: planIds.planMoveTicket,
        ticketId: tickets.ticketMove,
        ...(extra as object),
      });
      expect(res.statusCode, label).toBe(422);
      expect(res.json().error.field, label).toBe(field);
    }
    const unknown = await post('/api/v1/pm/reschedule', headToken, {
      machineId: M(22),
      scheduledOn: TICKET_TO,
      reason: 'x',
    });
    expect(unknown.statusCode).toBe(422);

    const row = (
      await admin.query('SELECT task_expected_on::text AS day FROM ticket WHERE id = $1', [
        tickets.ticketMove,
      ])
    ).rows[0];
    expect(row.day).toBe(TICKET_TO);
  });

  it('refuses a technician with 403 and a request without an idempotency key with 422', async () => {
    const body = {
      machineId: M(22),
      planId: planIds.planMoveTicket,
      ticketId: tickets.ticketMove,
      scheduledOn: TICKET_TO,
    };
    const forbidden = await post('/api/v1/pm/reschedule', techToken, body);
    expect(forbidden.statusCode).toBe(403);
    const noKey = await post('/api/v1/pm/reschedule', headToken, body, null);
    expect(noKey.statusCode).toBe(422);
    expect(noKey.json().error.field).toBe('idempotencyKey');
    expect(noKey.json().error.message).toContain('Idempotency-Key');
  });
});

describe('tenancy (R10)', () => {
  it("answers 404 for another plant's plan and writes nothing", async () => {
    const before = await admin.query(`SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1`, [
      TENANT,
    ]);
    const res = await post('/api/v1/pm/reschedule', headToken, {
      machineId: M(21),
      planId: planIds.planB,
      ticketId: null,
      scheduledOn: MOVE_TO,
    });
    expect(res.statusCode).toBe(404);
    const after = await admin.query(`SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1`, [
      TENANT,
    ]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it("shows one plant's dates only in its own calendar", async () => {
    const cosmos = await calendar();
    expect(cosmos.some((item) => item.machineCode === 'VC-B')).toBe(false);

    const other = await calendar(headBToken, 'plant-two.localhost');
    expect(other).toHaveLength(1);
    expect(other[0]).toMatchObject({ machineCode: 'VC-B', planId: planIds.planB, dueOn: DUE_LONG });
  });
});
