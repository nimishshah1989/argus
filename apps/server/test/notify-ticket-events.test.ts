import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import webpush from 'web-push';
import { buildApp } from '../src/app.js';
import { contributeTicketListener } from '../src/kernel/index.js';
import { processNotification } from '../src/modules/notifications/index.js';
import { startTestDb, type TestDb } from './harness.js';

const A = '33000000-0000-4000-8000-00000000000a';
const B = '33000000-0000-4000-8000-00000000000b';
const id = (n: number): string =>
  `33000000-0000-4000-8000-0000000000${n.toString(16).padStart(2, '0')}`;
const ASHA = id(0x10);
const BINA = id(0x11);
const TESTER = id(0x12);
const OPERA = id(0x13);
const HEAD = id(0x14);
const GONE = id(0x15);
const LEFT = id(0x16);
const QUIT = id(0x18);
const OTHER = id(0x17);
const MACHINES = Array.from({ length: 20 }, (_, i) => id(0x30 + i));
const PASSWORD = 'correct-horse-battery';
const PHONE = 'https://fcm.googleapis.com/fcm/send/asha-phone';

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let app: App;
const tokens: Record<string, string> = {};
let nextMachine = 0;
let keys = 0;
const send = vi.spyOn(webpush, 'sendNotification');

const post = (url: string, token: string, payload: unknown) =>
  app.inject({
    method: 'POST',
    url,
    headers: {
      host: 'cosmos.localhost',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': `k-${(keys += 1)}`,
    },
    payload: payload as object,
  });

async function login(username: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
    payload: { username, password: PASSWORD },
  });
  return res.json().token as string;
}

async function raise(token: string, extra: Record<string, unknown> = {}): Promise<string> {
  const machineId = MACHINES[nextMachine++]!;
  const res = await post('/api/v1/tickets', token, {
    machineId,
    problem: 'Spindle alarm',
    ...extra,
  });
  expect(res.statusCode).toBe(201);
  return res.json().ticket.id as string;
}

async function told(ticketId: string) {
  const rows = await db.admin.query(
    'SELECT person_id, kind, channel, ticket_id FROM notification WHERE ticket_id = $1 ORDER BY person_id',
    [ticketId],
  );
  return rows.rows as { person_id: string; kind: string; channel: string; ticket_id: string }[];
}

beforeAll(async () => {
  const k = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = k.publicKey;
  process.env.VAPID_PRIVATE_KEY = k.privateKey;
  send.mockResolvedValue({ statusCode: 201, body: '', headers: {} });
  db = await startTestDb();
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  for (const [t, slug] of [
    [A, 'cosmos'],
    [B, 'plant-two'],
  ] as const)
    await db.admin.query('INSERT INTO tenant (id, slug, name) VALUES ($1, $2, $2)', [t, slug]);
  await db.admin.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0)",
    [id(0x20), A],
  );
  await db.admin.query(
    `INSERT INTO machine (id, tenant_id, code, segment_id, category, cell)
     SELECT m, $2, 'EV-' || n, $3, 'VMC', 'Cell-1' FROM unnest($1::uuid[]) WITH ORDINALITY AS u(m, n)`,
    [MACHINES, A, id(0x20)],
  );
  const people: [string, string, string, string, boolean][] = [
    [ASHA, A, 'asha', 'technician', true],
    [BINA, A, 'bina', 'technician', true],
    [TESTER, A, 'tester', 'supervisor', true],
    [OPERA, A, 'opera', 'operator', true],
    [HEAD, A, 'head', 'head', true],
    [GONE, A, 'gone', 'technician', false],
    [LEFT, A, 'left', 'technician', true],
    [OTHER, B, 'other', 'technician', true],
    [QUIT, A, 'quit', 'operator', true],
  ];
  for (const [person, tenant, username, role, active] of people) {
    await db.admin.query(
      'INSERT INTO person (id, tenant_id, name, active) VALUES ($1, $2, $3, $4)',
      [person, tenant, `${username} Testperson`, active],
    );
    await db.admin.query(
      `INSERT INTO login (tenant_id, person_id, username, password_hash, role, disabled_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenant, person, username, passwordHash, role, username === 'left' ? new Date() : null],
    );
  }
  await db.admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [A],
  );
  await db.admin.query(
    `INSERT INTO push_subscription (tenant_id, login_id, acting_person_id, endpoint, keys, role)
     SELECT $1, l.id, $2, $3, '{"p256dh":"k","auth":"a"}', 'technician' FROM login l WHERE l.person_id = $2`,
    [A, ASHA, PHONE],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  for (const [, , username] of people)
    if (username !== 'left' && username !== 'other' && username !== 'gone')
      tokens[username] = await login(username);
}, 180_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('a new breakdown tells the maintenance side', () => {
  it('tells every active technician and supervisor of the plant, never the reporter, a head, a switched-off or another plant', async () => {
    const ticketId = await raise(tokens.opera!);
    expect(await told(ticketId)).toEqual(
      [ASHA, BINA, TESTER].sort().map((person_id) => ({
        person_id,
        kind: 'breakdown.new',
        channel: 'push',
        ticket_id: ticketId,
      })),
    );
  });

  it('does not tell the reporter, even a technician', async () => {
    const ticketId = await raise(tokens.asha!);
    expect((await told(ticketId)).map((n) => n.person_id)).toEqual([BINA, TESTER].sort());
  });

  it('is a push that arrives on the technician phone with the ticket to open', async () => {
    const ticketId = await raise(tokens.opera!);
    send.mockClear();
    const mine = (
      await db.admin.query('SELECT id FROM notification WHERE ticket_id = $1 AND person_id = $2', [
        ticketId,
        ASHA,
      ])
    ).rows[0].id as string;
    await processNotification(
      { pool: db.app, boss: null, now: new Date() },
      { tenantId: A, notificationId: mine },
    );
    expect(send).toHaveBeenCalledTimes(1);
    const [sub, body] = send.mock.calls[0] as unknown as [{ endpoint: string }, string];
    expect(sub.endpoint).toBe(PHONE);
    expect(JSON.parse(body)).toMatchObject({ body: 'New breakdown', ticketId });
  });

  it('tells nobody about support or general tickets', async () => {
    const ticketId = await raise(tokens.opera!, { kind: 'support' });
    expect(await told(ticketId)).toEqual([]);
  });
});

describe('a fixed complaint tells the person who reported it', () => {
  async function started(token: string): Promise<string> {
    const ticketId = await raise(token);
    expect(
      (await post(`/api/v1/tickets/${ticketId}/start`, tokens.asha!, { personId: ASHA }))
        .statusCode,
    ).toBe(200);
    return ticketId;
  }

  it('tells the reporter once when a technician closes the ticket', async () => {
    const ticketId = await started(tokens.opera!);
    await db.admin.query('DELETE FROM notification');
    const closed = await post(`/api/v1/tickets/${ticketId}/close`, tokens.asha!, {
      personId: ASHA,
      kind: 'report',
    });
    expect(closed.statusCode).toBe(200);
    expect(await told(ticketId)).toEqual([
      { person_id: OPERA, kind: 'complaint.fixed', channel: 'push', ticket_id: ticketId },
    ]);
  });

  it('does not tell someone who closed their own ticket, and says nothing when a ticket is cancelled', async () => {
    const own = await started(tokens.asha!);
    await db.admin.query('DELETE FROM notification');
    await post(`/api/v1/tickets/${own}/close`, tokens.asha!, { personId: ASHA, kind: 'report' });
    expect(await told(own)).toEqual([]);
    const cancelled = await raise(tokens.opera!);
    await db.admin.query('DELETE FROM notification');
    expect(
      (
        await post(`/api/v1/tickets/${cancelled}/cancel`, tokens.asha!, {
          personId: ASHA,
          reason: 'Duplicate',
        })
      ).statusCode,
    ).toBe(200);
    expect(await told(cancelled)).toEqual([]);
  });
});

it('keeps the notification ids free of names and phones', async () => {
  const text = JSON.stringify((await db.admin.query('SELECT * FROM notification')).rows);
  expect(text).not.toMatch(/Testperson|Spindle/);
});

describe('an upgrade to a breakdown is a new breakdown', () => {
  it('tells the maintenance side once, when a support ticket becomes a stopped one', async () => {
    const ticketId = await raise(tokens.opera!, { kind: 'support' });
    expect(await told(ticketId)).toEqual([]);
    const res = await post(`/api/v1/tickets/${ticketId}/upgrade-kind`, tokens.opera!, {});
    expect(res.statusCode, res.body).toBe(200);
    expect((await told(ticketId)).map((n) => n.person_id)).toEqual([ASHA, BINA, TESTER].sort());
  });
});

describe('a person who has left is not told their complaint is fixed', () => {
  it('sends nothing to a switched-off reporter', async () => {
    const ticketId = await raise(tokens.quit!);
    await post(`/api/v1/tickets/${ticketId}/start`, tokens.asha!, { personId: ASHA });
    await db.admin.query('UPDATE person SET active = false WHERE id = $1', [QUIT]);
    await db.admin.query('DELETE FROM notification');
    const closed = await post(`/api/v1/tickets/${ticketId}/close`, tokens.asha!, {
      personId: ASHA,
      kind: 'report',
    });
    expect(closed.statusCode).toBe(200);
    expect(await told(ticketId)).toEqual([]);
  });
});

describe('a notification problem never fails the ticket write', () => {
  const ticketExists = async (ticketId: string): Promise<boolean> =>
    ((await db.admin.query('SELECT 1 FROM ticket WHERE id = $1', [ticketId])).rowCount ?? 0) > 0;

  it.each([
    ['throws', async () => Promise.reject(new Error('listener broke'))],
    [
      'runs a failing statement',
      async (client: { query: (sql: string) => Promise<unknown> }) => {
        await client.query('SELECT 1 / 0');
      },
    ],
  ])('a listener that %s still gives the 201 and the ticket', async (_name, broken) => {
    contributeTicketListener('broken', broken as never);
    try {
      const ticketId = await raise(tokens.opera!);
      expect(await ticketExists(ticketId)).toBe(true);
      expect((await told(ticketId)).length).toBe(3);
    } finally {
      contributeTicketListener('broken', async () => undefined);
    }
  });
});
