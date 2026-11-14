import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FIXTURE_PASSWORD } from '../src/seed/cosmos.js';
import { startRealPlant, type RealPlant } from './real-plant.js';

let plant: RealPlant;
/** Two real tickets with a report, on machines in different cells; `mine` was raised by the first operator. */
let mine: { id: string; cell: string };
let theirs: { id: string; cell: string };
const tokens: Record<string, string> = {};

const pdf = (ticketId: string, who: string) =>
  plant.get(`/api/v1/tickets/${ticketId}/pdf`, tokens[who] as string);

beforeAll(async () => {
  plant = await startRealPlant();
  const pair = (
    await plant.db.admin.query(
      `SELECT t.id, t.machine_snapshot->>'cell' AS cell
         FROM ticket t JOIN breakdown_report r ON r.ticket_id = t.id
        WHERE t.machine_snapshot->>'cell' IS NOT NULL ORDER BY t.ref`,
    )
  ).rows as Array<{ id: string; cell: string }>;
  mine = pair[0] as { id: string; cell: string };
  theirs = pair.find((row) => row.cell !== mine.cell) as { id: string; cell: string };
  const operators = (
    await plant.db.admin.query(
      "SELECT id, username FROM login WHERE role = 'operator' ORDER BY username LIMIT 2",
    )
  ).rows;
  await plant.db.admin.query('UPDATE ticket SET raised_login_id = $1 WHERE id = $2', [
    operators[0].id,
    mine.id,
  ]);
  for (const [who, op] of [
    ['operator', operators[0]],
    ['otherOperator', operators[1]],
  ] as const) {
    const res = await plant.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
      payload: { username: op.username, password: FIXTURE_PASSWORD },
    });
    tokens[who] = res.json().token;
  }
  tokens.sharedOwnCell = await plant.signIn({
    username: 'floor-own',
    role: 'operator',
    shared: true,
    cell: mine.cell,
  });
  tokens.sharedOtherCell = await plant.signIn({
    username: 'floor-other',
    role: 'operator',
    shared: true,
    cell: theirs.cell,
  });
  for (const role of ['technician', 'supervisor', 'head', 'plant_head', 'admin', 'board']) {
    tokens[role] = await plant.signIn({ username: `t-${role}`, role });
  }
}, 300_000);

afterAll(async () => {
  await plant.stop();
});

describe('who may print a breakdown PDF', () => {
  it.each(['technician', 'supervisor', 'head', 'plant_head', 'admin'])(
    'gives it to a %s',
    async (role) => {
      const res = await pdf(theirs.id, role);
      expect(res.statusCode).toBe(200);
      expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    },
  );

  it('gives an operator the breakdowns they reported, and no one else’s', async () => {
    expect((await pdf(mine.id, 'operator')).statusCode).toBe(200);
    const other = await pdf(mine.id, 'otherOperator');
    expect(other.statusCode).toBe(403);
    expect(other.json().error.code).toBe('forbidden');
    expect((await pdf(theirs.id, 'operator')).statusCode).toBe(403);
  });

  it('gives a shared floor login its own cell’s breakdowns only', async () => {
    expect((await pdf(mine.id, 'sharedOwnCell')).statusCode).toBe(200);
    expect((await pdf(theirs.id, 'sharedOwnCell')).statusCode).toBe(403);
    expect((await pdf(mine.id, 'sharedOtherCell')).statusCode).toBe(403);
  });

  it('says no before it says there is no report: an operator asking for another’s unreported ticket gets 403', async () => {
    const unreported = (
      await plant.db.admin.query(
        `SELECT t.id FROM ticket t
          WHERE NOT EXISTS (SELECT 1 FROM breakdown_report r WHERE r.ticket_id = t.id)
          ORDER BY t.ref LIMIT 1`,
      )
    ).rows[0].id;
    expect((await pdf(unreported, 'operator')).statusCode).toBe(403);
    expect((await pdf(unreported, 'technician')).statusCode).toBe(409);
  });

  it('gives the board login nothing', async () => {
    expect((await pdf(mine.id, 'board')).statusCode).toBe(403);
  });

  it('keeps one plant out of another’s: a ticket of this plant is unknown to a login of another', async () => {
    const other = randomUUID();
    await plant.db.admin.query(
      "INSERT INTO tenant (id, slug, name) VALUES ($1, 'plant-two', 'Plant Two')",
      [other],
    );
    const stranger = (
      await plant.db.admin.query(
        "INSERT INTO person (tenant_id, name, team) VALUES ($1, 'Outsider', 'maintenance') RETURNING id",
        [other],
      )
    ).rows[0].id;
    await plant.db.admin.query(
      `INSERT INTO login (tenant_id, person_id, username, password_hash, role)
       SELECT $1, $3, 'boss', password_hash, 'admin' FROM login WHERE tenant_id = $2 LIMIT 1`,
      [other, plant.tenantId, stranger],
    );
    const login = await plant.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: 'plant-two.localhost', 'content-type': 'application/json' },
      payload: { username: 'boss', password: FIXTURE_PASSWORD },
    });
    const res = await plant.get(
      `/api/v1/tickets/${mine.id}/pdf`,
      login.json().token,
      'plant-two.localhost',
    );
    expect(res.statusCode).toBe(404);
  });
});
