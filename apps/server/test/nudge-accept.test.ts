import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actionCenterBoardSchema, nudgeTicketReplySchema } from '@uptimo/shared';
import type { NudgeAck } from '@uptimo/domain';
import { withTenant } from '../src/kernel/index.js';
import { raisedTicketsFor } from '../src/modules/tickets/index.js';
import { plantToday } from '../src/modules/plant/index.js';
import { A, M_B, M_FREE, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

/**
 * Ticket 52, packet 52c: an accepted Action Center nudge becomes one linked inspection ticket (R17). The ticket is
 * the tickets module's own planned raise (kind `general`, `WR-`, channel `inspection`); the link is the raise
 * event's payload `{source:{nudge:<key>}}` (R16), read back through `tickets.raisedTicketsFor`; the nudge is
 * resolved with one `nudge.accept` line. The live plant's `freq`, `cell`, `long`, `shift` and good-news nudges are
 * seeded here as data, so the multi-machine, no-machine, info, role and tenant refusals are proven on real cards.
 */

const NUDGE = 'nudge:';
const FREQ_KEY = `freq|${M_USED}`;

let f: Fixture;
let today: string;
let nextRef = 7000;

/** The plant date `days` before `day`: both are `YYYY-MM-DD`, so no zone is involved. */
function dayBefore(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** One closed breakdown with its report: the evidence every nudge rule reads. */
async function seedBreakdown(input: {
  machineId: string;
  day: string;
  code: string;
  minutes: number;
  shift?: string;
}): Promise<void> {
  nextRef += 1;
  const start = `${input.day}T08:00:00+05:30`;
  const ticket = (
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, severity, downtime_min)
       VALUES ($1, $2, 'stopped', 'closed', $3, 'Breakdown', $4, $4, 'S3', $5) RETURNING id`,
      [A, `BD-${nextRef}`, input.machineId, start, input.minutes],
    )
  ).rows[0].id as string;
  await f.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, maint_code)
     VALUES ($1, $2, $3, $4, $5, 'Breakdown', $6, $7)`,
    [A, ticket, input.machineId, input.day, input.shift ?? 'DAY', input.minutes, input.code],
  );
}

/** The board the route reads, parsed against the published contract. */
async function board(token = f.tokens.head!) {
  const res = await f.call('GET', '/api/v1/analytics/action-center', token);
  expect(res.statusCode).toBe(200);
  return actionCenterBoardSchema.parse(res.json());
}

/** The one current nudge with this rule (`freq`, `cell`, `shift`, …), or a failure naming it. */
const nudgeOf = (
  boardValue: Awaited<ReturnType<typeof board>>,
  rule: string,
): Awaited<ReturnType<typeof board>>['nudges'][number] => {
  const nudge = boardValue.nudges.find((candidate) => candidate.rule === rule);
  expect(nudge, `a ${rule} nudge`).toBeDefined();
  return nudge!;
};

const accept = (key: string, body: object = {}, token = f.tokens.supervisor!) =>
  f.call(
    'POST',
    `/api/v1/analytics/action-center/nudges/${encodeURIComponent(key)}/ticket`,
    token,
    body,
  );

const inspectionTickets = async () =>
  (
    await f.admin.query(
      `SELECT id, ref, kind, status, machine_id, problem, raised_channel,
              reported_by_person_id, raised_login_id
         FROM ticket WHERE tenant_id = $1 AND raised_channel = 'inspection' ORDER BY ref`,
      [A],
    )
  ).rows as Array<Record<string, string>>;

/** The raise event's payload: where the nudge link lives (R16). */
const downPayload = async (ticketId: string) =>
  (
    await f.admin.query(
      `SELECT payload FROM ticket_event WHERE tenant_id = $1 AND ticket_id = $2 AND type = 'down'`,
      [A, ticketId],
    )
  ).rows[0].payload as Record<string, unknown>;

const storedAck = async (key: string): Promise<NudgeAck | undefined> =>
  (
    await f.admin.query('SELECT value FROM setting WHERE tenant_id = $1 AND key = $2', [
      A,
      `${NUDGE}${key}`,
    ])
  ).rows[0]?.value as NudgeAck | undefined;

const acceptAudits = async () =>
  (
    await f.admin.query(
      `SELECT action, entity, entity_id, login_id, before, after
         FROM audit_log WHERE tenant_id = $1 AND action = 'nudge.accept' ORDER BY at, id`,
      [A],
    )
  ).rows as Array<Record<string, unknown>>;

beforeAll(async () => {
  f = await startFixture();
  today = await withTenant(f.db.app, A, (tx) => plantToday(tx, A));
  // freq|M_USED: four breakdowns today on one machine.
  for (let index = 0; index < 4; index += 1)
    await seedBreakdown({ machineId: M_USED, day: today, code: 'BRG', minutes: 15 });
  // cell|Cell 1|BRG: five BRG reports across the two machines of Cell 1.
  await seedBreakdown({ machineId: M_FREE, day: today, code: 'BRG', minutes: 15 });
  // shift|NIGHT: sixteen night reports against the day ones (21 production breakdowns in 30 days).
  for (let index = 0; index < 16; index += 1)
    await seedBreakdown({
      machineId: M_USED,
      day: today,
      code: 'MOT',
      minutes: 10,
      shift: 'NIGHT',
    });
  // The quiet week against a heavy four weeks: two long reports in the previous window make the good-news card.
  await seedBreakdown({
    machineId: M_FREE,
    day: dayBefore(today, 8),
    code: 'MOT',
    minutes: 21 * 60,
  });
  await seedBreakdown({
    machineId: M_FREE,
    day: dayBefore(today, 9),
    code: 'MOT',
    minutes: 21 * 60,
  });
}, 180_000);

afterAll(async () => f.stop());

describe('accepting a nudge into a linked ticket through HTTP', () => {
  it('accepts the live freq nudge into one inspection ticket linked by its raise event', async () => {
    const nudge = nudgeOf(await board(), 'freq');
    const res = await accept(FREQ_KEY, {});
    expect(res.statusCode).toBe(200);
    const reply = nudgeTicketReplySchema.parse(res.json());
    expect(reply.created).toBe(true);
    expect(reply.ref).toMatch(/^WR-\d+$/);

    const tickets = await inspectionTickets();
    expect(tickets).toHaveLength(1);
    const supervisor = (
      await f.admin.query(
        "SELECT id, person_id FROM login WHERE tenant_id = $1 AND username = 'plant-a-supervisor'",
        [A],
      )
    ).rows[0];
    expect(tickets[0]).toMatchObject({
      id: reply.ticketId,
      ref: reply.ref,
      kind: 'general',
      status: 'open',
      machine_id: M_USED,
      problem: nudge.title,
      raised_channel: 'inspection',
      // The accept's reporter is the acting person, and the login that caused the raise is the caller (R17).
      reported_by_person_id: supervisor.person_id,
      raised_login_id: supervisor.id,
    });
    // The link is the raise event's payload, and the tickets module reads it back (R16).
    expect((await downPayload(reply.ticketId)).source).toEqual({ nudge: FREQ_KEY });
    const links = await withTenant(f.db.app, A, (tx) =>
      raisedTicketsFor(tx, A, 'nudge', [FREQ_KEY]),
    );
    expect(links.get(FREQ_KEY)).toMatchObject({
      id: reply.ticketId,
      ref: reply.ref,
      status: 'open',
    });

    // The nudge is resolved with the accept's own record, and the board says so.
    expect(await storedAck(FREQ_KEY)).toMatchObject({
      status: 'done',
      owner: '',
      due: '',
      note: '',
    });
    expect(nudgeOf(await board(), 'freq').status).toBe('resolved');

    const audits = await acceptAudits();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      entity: 'ticket',
      entity_id: reply.ticketId,
      login_id: expect.any(String),
      before: null,
    });
    expect(audits[0]!.after).toMatchObject({
      key: FREQ_KEY,
      ticketId: reply.ticketId,
      ref: reply.ref,
      ack: { status: 'done' },
    });
  });

  it('answers the same ticket on a second accept and writes nothing, and the ack route still refuses it', async () => {
    const [first] = await inspectionTickets();
    const res = await accept(FREQ_KEY, {});
    expect(res.statusCode).toBe(200);
    const reply = nudgeTicketReplySchema.parse(res.json());
    expect(reply.created).toBe(false);
    expect(reply.ticketId).toBe(first!.id);
    expect(reply.ref).toBe(first!.ref);
    expect(await inspectionTickets()).toHaveLength(1);
    expect(await acceptAudits()).toHaveLength(1);
    // 44c's write route is unchanged: a resolved nudge is not acknowledged or snoozed again (409).
    const refused = await f.call(
      'PUT',
      `/api/v1/analytics/action-center/nudges/${encodeURIComponent(FREQ_KEY)}`,
      f.tokens.supervisor!,
      { status: 'ack' },
    );
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.code).toBe('conflict');
  });

  it('needs a machine for a nudge that names several, and raises the chosen one', async () => {
    const cell = nudgeOf(await board(), 'cell');
    expect(cell.machines).toHaveLength(2);
    const missing = await accept(cell.key, {});
    expect(missing.statusCode).toBe(422);
    expect(missing.json().error.field).toBe('machineId');
    // A machine that is not one of the nudge's own (here another plant's machine) is refused.
    const foreign = await accept(cell.key, { machineId: M_B });
    expect(foreign.statusCode).toBe(422);
    expect(foreign.json().error.field).toBe('machineId');

    const res = await accept(cell.key, { machineId: M_FREE });
    expect(res.statusCode).toBe(200);
    const reply = nudgeTicketReplySchema.parse(res.json());
    expect(reply.created).toBe(true);
    const ticket = (await inspectionTickets()).find((one) => one.id === reply.ticketId);
    expect(ticket).toMatchObject({ machine_id: M_FREE, problem: cell.title });
    expect((await downPayload(reply.ticketId)).source).toEqual({ nudge: cell.key });
    expect(await inspectionTickets()).toHaveLength(2);
  });

  it('accepts a nudge a person has snoozed, then answers that same link (R17)', async () => {
    const long = nudgeOf(await board(), 'long');
    const snoozed = await f.call(
      'PUT',
      `/api/v1/analytics/action-center/nudges/${encodeURIComponent(long.key)}`,
      f.tokens.supervisor!,
      { status: 'snooze' },
    );
    expect(snoozed.statusCode).toBe(200);
    expect(nudgeOf(await board(), 'long').status).toBe('snoozed');

    const res = await accept(long.key, {});
    expect(res.statusCode).toBe(200);
    const reply = nudgeTicketReplySchema.parse(res.json());
    expect(reply.created).toBe(true);
    expect((await inspectionTickets()).find((one) => one.id === reply.ticketId)).toMatchObject({
      machine_id: M_FREE,
    });
    expect(await storedAck(long.key)).toMatchObject({ status: 'done' });
    // The link, not the ack, is what a second accept reads (R17).
    const again = await accept(long.key, {});
    expect(nudgeTicketReplySchema.parse(again.json())).toEqual({ ...reply, created: false });
  });

  it('refuses a nudge that names no machine with 422 on the key', async () => {
    const shift = nudgeOf(await board(), 'shift');
    expect(shift.machines).toEqual([]);
    const before = await inspectionTickets();
    const res = await accept(shift.key, {});
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('key');
    expect(await inspectionTickets()).toHaveLength(before.length);
  });

  it('refuses the good-news (info) nudge with 409', async () => {
    const good = nudgeOf(await board(), 'good');
    expect(good.sev).toBe('info');
    const res = await accept(good.key, {});
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatchObject({ code: 'conflict', field: 'key' });
  });

  it('refuses an operator and the board login with 403, writing nothing', async () => {
    const before = {
      tickets: (await inspectionTickets()).length,
      audits: (await acceptAudits()).length,
    };
    for (const role of ['operator', 'board']) {
      const res = await accept(FREQ_KEY, {}, f.tokens[role]!);
      expect(res.statusCode, role).toBe(403);
    }
    expect(await inspectionTickets()).toHaveLength(before.tickets);
    expect(await acceptAudits()).toHaveLength(before.audits);
  });

  it("answers 404 for a made-up key and another tenant's key", async () => {
    const madeUp = 'freq|00000000-0000-0000-0000-000000000000';
    expect((await accept(madeUp)).statusCode).toBe(404);
    expect((await accept(FREQ_KEY, {}, f.tokens['b-admin']!)).statusCode).toBe(404);
  });

  it("enforces the route's contract: an unknown field and a non-uuid machine are 422", async () => {
    const extra = await accept(FREQ_KEY, { ticketId: 'x' } as object);
    expect(extra.statusCode).toBe(422);
    const badMachine = await accept(FREQ_KEY, { machineId: 'not-a-uuid' });
    expect(badMachine.statusCode).toBe(422);
    expect(badMachine.json().error.field).toBe('machineId');
    // A success carries exactly the three published fields, and its ticket id is a uuid the link read returns.
    const link = await withTenant(f.db.app, A, (tx) =>
      raisedTicketsFor(tx, A, 'nudge', [FREQ_KEY]),
    );
    const body = { ticketId: link.get(FREQ_KEY)!.id, ref: link.get(FREQ_KEY)!.ref, created: false };
    expect(nudgeTicketReplySchema.safeParse(body).success).toBe(true);
    expect(nudgeTicketReplySchema.safeParse({ ...body, extra: true }).success).toBe(false);
  });
});
