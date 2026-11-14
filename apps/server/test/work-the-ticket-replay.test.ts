import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  parseBhavinExport,
  type RealEvent,
  type RealTicket,
} from '../src/modules/imports/bhavin-export.js';
import { checkTicketFigures } from '../src/modules/imports/real-oracle.js';
import { startTestDb, type TestDb } from './harness.js';
import { EXPECTED_DIFFS, NOT_REPLAYED } from './work-the-ticket-differences.js';

/**
 * Every real ticket of his export is raised and then worked through our command routes, with the clock set to the
 * time each step was written in his app and the back-dated times in the request bodies. What comes out must be
 * what his `worker.js` computed (the oracle), or sit in the written-down differences with its cause.
 */
const MIN = 60000;
const TENANT = randomUUID();
const PASSWORD = 'correct-horse-battery';
const exported = parseBhavinExport(
  JSON.parse(
    readFileSync(new URL('./fixtures/bhavin-export.pseudonymised.json', import.meta.url), 'utf8'),
  ) as unknown,
);

let db: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;
let token = '';
let keys = 0;
let compared = 0;
const people = new Map<string, string>();
const machines = new Map<string, string>();

async function personId(name: string): Promise<string> {
  const known = people.get(name);
  if (known) return known;
  const id = randomUUID();
  await db.admin.query(
    "INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $2, $3, 'maintenance', 'Technician')",
    [id, TENANT, name],
  );
  people.set(name, id);
  return id;
}

async function call(method: 'POST' | 'GET', url: string, payload?: object) {
  keys += 1;
  return app.inject({
    method,
    url,
    headers: {
      host: 'cosmos.localhost',
      authorization: `Bearer ${token}`,
      ...(method === 'POST'
        ? { 'content-type': 'application/json', 'idempotency-key': `replay-${keys}` }
        : {}),
    },
    ...(payload ? { payload } : {}),
  });
}

function clock(iso: string | number): void {
  vi.setSystemTime(new Date(iso));
}

const byTime = (a: RealEvent, b: RealEvent): number => Date.parse(a.at) - Date.parse(b.at);
const isStep = (e: RealEvent): boolean =>
  !['segment', 'lead', 'task', 'edit', 'report'].includes(e.type);

type Step = [path: string, body: Record<string, unknown>, now: string | number];

/** One of his events as the request that makes our API do the same thing, and the time it was written. */
async function stepFor(x: RealTicket, e: RealEvent, all: RealEvent[]): Promise<Step | null> {
  const personId_ = await personId(e.by);
  const body = { personId: personId_ };
  const firstStart = all.find((s) => s.type === 'start');
  switch (e.type) {
    case 'start':
      return [
        'start',
        { ...body, ...(e === firstStart && x.startedAt ? { at: x.startedAt } : {}) },
        e.at,
      ];
    case 'pickup':
      return ['start', body, e.at];
    case 'transfer': {
      const to = e.spare ? await personId(e.spare) : undefined;
      return [
        'transfer',
        { ...body, note: e.text || 'handed over', ...(to ? { toPersonId: to } : {}) },
        e.at,
      ];
    }
    case 'pause':
      return ['pause', { ...body, reasonCode: e.spare, ...(e.text ? { note: e.text } : {}) }, e.at];
    case 'resume': {
      // the time he stored is the write time unless the person back-dated it; the minutes waited tell which
      const pause = [...all].filter((p) => p.type === 'pause' && p.at < e.at).pop();
      const waited = pause ? Math.round((Date.parse(e.at) - Date.parse(pause.at)) / MIN) : 0;
      const when = pause && waited !== e.mins ? Date.parse(pause.at) + (e.mins ?? 0) * MIN : e.at;
      return ['resume', body, when];
    }
    case 'update':
      return ['update', { ...body, text: e.text || 'update' }, e.at];
    case 'join':
      return ['join', { ...body, role: e.spare === 'support' ? 'support' : 'primary' }, e.at];
    case 'leave':
      return ['leave', { ...body, reason: e.text || 'left' }, e.at];
    case 'running':
      return ['machine-running', { ...body, at: e.eta }, e.at];
    case 'stopped':
      return ['machine-stopped', { ...body, at: e.eta }, e.at];
    case 'cancel':
      return ['cancel', { ...body, reason: e.text || 'cancelled' }, e.at];
    case 'close':
      return [
        'close',
        {
          ...body,
          kind: x.kind === 'general' ? 'done' : 'no_report',
          note: e.text || 'closed',
          ...(x.closedAt ? { at: x.closedAt } : {}),
        },
        e.at,
      ];
    default:
      return null;
  }
}

interface Got {
  status: string;
  transfers: number;
  leadPersonId: string | null;
  figures: Record<string, number | null> & { perPerson: Record<string, number> };
}

interface Replayed {
  ticket: Partial<Got>;
  failed: string[];
}

async function replay(x: RealTicket): Promise<Replayed> {
  const events = [...x.events].sort(byTime).filter(isStep);
  const down = events.find((e) => e.type === 'down');
  const selfStart =
    x.selfStarted && events.find((e) => e.type === 'start' && /raised and started/.test(e.text));
  clock(x.downAt);
  const raised = await call('POST', '/api/v1/tickets', {
    kind: x.kind,
    ...(x.kind === 'general'
      ? { location: x.location || 'Shop', workType: x.workType || 'Pending task' }
      : { machineId: machines.get(x.machine) }),
    problem: x.problem || down?.text || 'problem',
    ...(selfStart ? { startNow: true, startByPersonId: await personId(selfStart.by) } : {}),
  });
  const failed: string[] = [];
  if (raised.statusCode !== 201)
    return { ticket: {}, failed: [`raise ${raised.statusCode} ${raised.body.slice(0, 120)}`] };
  const id = raised.json().ticket.id as string;
  for (const e of events) {
    if (e.type === 'down' || e === selfStart) continue;
    const step = await stepFor(x, e, events);
    if (!step) continue;
    clock(step[2]);
    const res = await call('POST', `/api/v1/tickets/${id}/${step[0]}`, step[1]);
    if (res.statusCode !== 200)
      failed.push(`${step[0]} ${res.statusCode} ${res.json().error?.message}`);
  }
  clock(x.closedAt || events[events.length - 1]?.at || x.downAt);
  const detail = await call('GET', `/api/v1/tickets/${id}`);
  if (detail.statusCode !== 200)
    failed.push('detail ' + detail.statusCode + detail.body.slice(0, 100));
  return { ticket: detail.json().ticket ?? {}, failed };
}

const FIGURE_KEY: Record<string, string> = {
  responseMin: 'responseMin',
  activeMin: 'activeMin',
  waitMin: 'waitMin',
  vendorMin: 'vendorMin',
  handoverWaitMin: 'handoverWaitMin',
  downAcc: 'downAccMin',
  repairMin: 'repairMin',
  followMin: 'followMin',
  downtimeMin: 'downtimeMin',
};

/** His per-person minutes: the sum of the `segment` rows written under each name. */
function hisPersonMinutes(x: RealTicket): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of x.events)
    if (e.type === 'segment' && e.mins) out[e.by] = (out[e.by] ?? 0) + e.mins;
  return out;
}

function compare(x: RealTicket, got: Got): string[] {
  const diffs: string[] = [];
  const nameOf = new Map([...people].map(([name, id]) => [id, name]));
  const f = got.figures;
  const cancelled = x.status === 'cancelled';
  for (const c of checkTicketFigures(x)) {
    compared += 1;
    if (cancelled && c.figure === 'activeMin') continue; // CANCEL_RULE
    const key = FIGURE_KEY[c.figure] as string;
    const his = c.oracle ?? (key === 'repairMin' ? 0 : null);
    if (f[key] !== his) diffs.push(`${x.ref} ${c.figure}: his ${his}, ours ${f[key]}`);
  }
  if (got.status !== x.status) diffs.push(`${x.ref} status: his ${x.status}, ours ${got.status}`);
  if (got.transfers !== x.transfers)
    diffs.push(`${x.ref} transfers: his ${x.transfers}, ours ${got.transfers}`);
  const lead = nameOf.get(got.leadPersonId ?? '') ?? null;
  if (['working', 'waiting', 'closed'].includes(x.status) && x.startedBy && lead !== x.startedBy)
    diffs.push(`${x.ref} lead: his ${x.startedBy}, ours ${lead}`);
  const his = hisPersonMinutes(x);
  const ours = Object.fromEntries(
    Object.entries(f.perPerson)
      .map(([id, m]) => [nameOf.get(id) as string, m] as const)
      .filter(([, m]) => m > 0),
  );
  for (const name of new Set([...Object.keys(his), ...Object.keys(ours)]))
    if (!cancelled && (his[name] ?? 0) !== (ours[name] ?? 0))
      diffs.push(`${x.ref} minutes of ${name}: his ${his[name] ?? 0}, ours ${ours[name] ?? 0}`);
  return diffs;
}

beforeAll(async () => {
  db = await startTestDb();
  await db.admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')", [
    TENANT,
  ]);
  const segment = randomUUID();
  await db.admin.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0)",
    [segment, TENANT],
  );
  for (const code of new Set(exported.tickets.filter((t) => t.machine).map((t) => t.machine))) {
    const id = randomUUID();
    machines.set(code, id);
    await db.admin.query(
      "INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES ($1, $2, $3, $4, 'VMC', 'Cell-1')",
      [id, TENANT, code, segment],
    );
  }
  for (const reason of new Set(
    exported.tickets.flatMap((t) => t.events.filter((e) => e.type === 'pause').map((e) => e.spare)),
  )) {
    await db.admin.query(
      "INSERT INTO list_item (tenant_id, list, code, label, is_vendor, pauses_sla) VALUES ($1, 'wait_reason', $2, $2, $3, false)",
      [TENANT, reason, /vendor/i.test(reason)],
    );
  }
  await db.admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [TENANT],
  );
  await db.admin.query(
    "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, NULL, 'phone', $3, 'technician', true)",
    [
      randomUUID(),
      TENANT,
      await hash(PASSWORD, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 }),
    ],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
    payload: { username: 'phone', password: PASSWORD, actingPersonId: await personId('Person 01') },
  });
  token = res.json().token as string;
  if (!token) throw new Error('login failed ' + res.body);
  vi.useFakeTimers({ toFake: ['Date'] });
}, 240_000);

afterAll(async () => {
  vi.useRealTimers();
  await app.close();
  await db.stop();
});

describe('his tickets, worked through our commands', () => {
  it('give the numbers worker.js gave, or a written-down difference with its cause', async () => {
    const found: string[] = [];
    const replayed: string[] = [];
    // tickets still open at the export go last: one open breakdown per machine
    const order = [...exported.tickets].sort(
      (a, b) =>
        Number(['open', 'working', 'waiting'].includes(a.status)) -
        Number(['open', 'working', 'waiting'].includes(b.status)),
    );
    for (const x of order) {
      if (NOT_REPLAYED[x.ref] || !x.events.some((e) => e.type === 'down')) continue;
      const { ticket, failed } = await replay(x);
      replayed.push(x.ref);
      for (const f of failed) found.push(`${x.ref} refused: ${f}`);
      if (ticket.figures) found.push(...compare(x, ticket as Got));
    }
    expect(replayed.length).toBeGreaterThan(250);
    expect(compared).toBeGreaterThan(2000);
    console.info(
      `replayed ${replayed.length} tickets, ${compared} figure comparisons, ${found.length} listed differences`,
    );
    const listed = new Set(Object.keys(EXPECTED_DIFFS));
    const unexplained = found.filter((d) => !listed.has(d));
    const stale = [...listed].filter((d) => !found.includes(d));
    expect({ unexplained, stale }).toEqual({ unexplained: [], stale: [] });
  }, 600_000);
});
