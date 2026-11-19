import { withTenant } from '@uptimo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runEngineFreeze } from '../src/modules/analytics/freeze.js';
import { runEngineRun } from '../src/modules/analytics/run.js';
import { raisedTicketsFor } from '../src/modules/tickets/index.js';
import {
  A,
  B,
  M_B,
  M_FREE,
  M_USED,
  SEG_A,
  startFixture,
  type Fixture,
} from './plant-settings-fixture.js';

/**
 * The scoring and inspection loop through the server (ticket 52, packet 52b): a frozen month is scored on the first
 * run after it ends, re-scored nightly through the 7th and final from the 8th (R8); the hit is `hours <= p80` (R13);
 * a month with no breakdown is still scored 0/0/hit (R15); a frozen Hot row raises one planned inspection ticket per
 * run through the tickets seam, its raise event carrying `{source:{forecast:<row id>}}` (R9/R11/R16), and the ticket's
 * close state is stored on the forecast row (R12). The fixture's production fleet is VC-01 (`M_FREE`), VC-02
 * (`M_USED`) and VC-03 (`M_EXTRA`, this file's third machine).
 */

/** A third production machine, so a Hot row can be scrapped before its inspection run (R9's one skip). */
const M_EXTRA = '10000000-0000-0000-0000-000000000199';
const NOV = '2026-11-01';
const DEC = '2026-12-01';
const AT = {
  freeze: new Date('2026-11-02T00:30:00Z'),
  dec1: new Date('2026-12-01T00:30:00Z'),
  dec2: new Date('2026-12-02T00:30:00Z'),
  dec3: new Date('2026-12-03T00:30:00Z'),
  dec4: new Date('2026-12-04T00:30:00Z'),
  dec8: new Date('2026-12-08T00:30:00Z'),
  jan4: new Date('2027-01-04T00:30:00Z'),
};

let f: Fixture;
let ref = 3000;

/** One closed breakdown on a machine: a ticket and its report, so the A9 core and the month's actuals read it. */
async function seedBreakdown(
  tenantId: string,
  machineId: string,
  date: string,
  hours: number,
): Promise<void> {
  ref += 1;
  const ticket = (
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, severity)
       VALUES ($1, $2, 'stopped', 'closed', $3, 'Seeded breakdown', $4, 'S3') RETURNING id`,
      [tenantId, `BD-${ref}`, machineId, `${date}T04:00:00Z`],
    )
  ).rows[0].id as string;
  await f.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min)
     VALUES ($1, $2, $3, $4, 'DAY', 'Seeded breakdown', $5)`,
    [tenantId, ticket, machineId, date, Math.round(hours * 60)],
  );
}

/** Twelve 12-hour episodes with a day between them, so the merge keeps them twelve and the machine is Hot. */
async function makeHot(machineId: string): Promise<void> {
  for (let index = 0; index < 12; index += 1)
    await seedBreakdown(A, machineId, `2026-11-${String(1 + index * 2).padStart(2, '0')}`, 12);
}

const forecastRows = async (tenantId: string, month: string) =>
  (
    await f.admin.query(
      `SELECT id, machine_id, predicted, outcome, scored_at
         FROM forecast WHERE tenant_id = $1 AND month = $2::date ORDER BY machine_id`,
      [tenantId, month],
    )
  ).rows;

const scoreAudit = async (tenantId: string, month: string) =>
  (
    await f.admin.query(
      `SELECT action, entity, entity_id, login_id, before, after
         FROM audit_log
        WHERE tenant_id = $1 AND action = 'forecast.score' AND after->>'month' = $2
        ORDER BY at, id`,
      [tenantId, month],
    )
  ).rows;

const raiseAudit = async (tenantId: string) =>
  (
    await f.admin.query(
      `SELECT action, entity, entity_id, login_id, after
         FROM audit_log WHERE tenant_id = $1 AND action = 'inspection.raise' ORDER BY at, id`,
      [tenantId],
    )
  ).rows;

const inspectionTickets = async (tenantId: string) =>
  (
    await f.admin.query(
      `SELECT id, ref, kind, status, machine_id, problem, raised_channel, closed_at
         FROM ticket WHERE tenant_id = $1 AND raised_channel = 'inspection' ORDER BY machine_id`,
      [tenantId],
    )
  ).rows;

const downPayload = async (tenantId: string, ticketId: string) =>
  (
    await f.admin.query(
      `SELECT payload FROM ticket_event WHERE tenant_id = $1 AND ticket_id = $2 AND type = 'down'`,
      [tenantId, ticketId],
    )
  ).rows[0].payload as Record<string, unknown>;

const oneDp = (value: number): string => (Math.round(value * 10) / 10).toFixed(1);

/** A ticket command the way the app sends it: JSON and an idempotency key, on plant A's host. */
const command = (id: string, action: string, token: string, payload: object) =>
  f.app.inject({
    method: 'POST',
    url: `/api/v1/tickets/${id}/${action}`,
    headers: {
      host: 'plant-a.localhost',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': `52b-${action}-${id}`,
    },
    payload,
  });

beforeAll(async () => {
  f = await startFixture();
  // A third production machine on plant A, frozen with the others and scrapped before its inspection run.
  await f.admin.query(
    "INSERT INTO machine (id, tenant_id, code, segment_id, cell) VALUES ($1, $2, 'VC-03', $3, 'Cell 1')",
    [M_EXTRA, A, SEG_A],
  );
  // One October breakdown per plant: the freeze needs a production breakdown to observe, and November itself is quiet.
  await seedBreakdown(A, M_USED, '2026-10-20', 2);
}, 180_000);
afterAll(async () => f.stop());

describe('the scoring pass', () => {
  it('writes nothing for a tenant whose months have no frozen rows', async () => {
    const result = await runEngineRun(f.db.app, {
      now: AT.dec1,
      tenantId: A,
      allowFakeClock: true,
    });
    expect(result).toEqual({ tenants: 1, scored: 0, raised: 0 });
    expect(await forecastRows(A, NOV)).toEqual([]);
    expect(await scoreAudit(A, NOV)).toEqual([]);
  });

  it('scores a closed month on the first run after it ends: every row gets an outcome and one forecast.score line', async () => {
    await runEngineFreeze(f.db.app, {
      now: AT.freeze,
      tenantId: A,
      allowFakeClock: true,
    });
    const result = await runEngineRun(f.db.app, {
      now: AT.dec1,
      tenantId: A,
      allowFakeClock: true,
    });
    expect(result).toEqual({ tenants: 1, scored: 3, raised: 0 });
    const rows = await forecastRows(A, NOV);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.outcome).not.toBeNull();
      expect((row.scored_at as Date).toISOString()).toBe(AT.dec1.toISOString());
      expect(row.outcome).toMatchObject({ hours: 0, episodes: 0, hit: true, inspection: null });
    }
    const audit = await scoreAudit(A, NOV);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'forecast.score',
      entity: 'forecast',
      entity_id: null,
      login_id: null,
      before: null,
      after: { month: NOV, rows: 3, hits: 3 },
    });
  });

  it('re-scores through the 7th: a late report grows the hours and moves scored_at', async () => {
    await seedBreakdown(A, M_USED, '2026-11-20', 3);
    const result = await runEngineRun(f.db.app, {
      now: AT.dec4,
      tenantId: A,
      allowFakeClock: true,
    });
    expect(result.scored).toBe(3);
    const rows = await forecastRows(A, NOV);
    const used = rows.find((row) => row.machine_id === M_USED)!;
    const p80 = (used.predicted as { p80: number }).p80;
    expect(used.outcome).toEqual({ hours: 3, episodes: 1, hit: 3 <= p80, inspection: null });
    expect((used.scored_at as Date).toISOString()).toBe(AT.dec4.toISOString());
    expect(await scoreAudit(A, NOV)).toHaveLength(2);
  });

  it('is final from the 8th: a later report changes nothing', async () => {
    await seedBreakdown(A, M_USED, '2026-11-25', 4);
    const before = await forecastRows(A, NOV);
    const result = await runEngineRun(f.db.app, {
      now: AT.dec8,
      tenantId: A,
      allowFakeClock: true,
    });
    expect(result).toEqual({ tenants: 1, scored: 0, raised: 0 });
    expect(await forecastRows(A, NOV)).toEqual(before);
    expect(await scoreAudit(A, NOV)).toHaveLength(2);
  });

  it('does not score a month that has not ended on the plant’s clock', async () => {
    await seedBreakdown(B, M_B, '2026-10-20', 2);
    await f.admin.query("UPDATE tenant SET time_zone = 'America/New_York' WHERE id = $1", [B]);
    await runEngineFreeze(f.db.app, { now: AT.freeze, tenantId: B, allowFakeClock: true });

    // 00:30 UTC on 1 December is still 30 November in New York.
    const early = await runEngineRun(f.db.app, {
      now: AT.dec1,
      tenantId: B,
      allowFakeClock: true,
    });
    expect(early).toEqual({ tenants: 1, scored: 0, raised: 0 });
    expect((await forecastRows(B, NOV)).every((row) => row.scored_at === null)).toBe(true);
    expect(await scoreAudit(B, NOV)).toEqual([]);

    // 05:30 UTC is midnight in New York: the month has ended.
    const late = await runEngineRun(f.db.app, {
      now: new Date('2026-12-01T05:30:00Z'),
      tenantId: B,
      allowFakeClock: true,
    });
    expect(late.scored).toBe(1);
    const [row] = await forecastRows(B, NOV);
    expect(row!.outcome).toEqual({ hours: 0, episodes: 0, hit: true, inspection: null });
    expect(await scoreAudit(B, NOV)).toHaveLength(1);
  });
});

describe('the inspection pass', () => {
  let usedTicket: Record<string, unknown>;
  let freeTicket: Record<string, unknown>;

  it('raises one inspection ticket per frozen Hot machine, through the planned seam', async () => {
    // Each machine gets twelve 12-hour November episodes, for three frozen Hot rows.
    await makeHot(M_USED);
    await makeHot(M_FREE);
    await makeHot(M_EXTRA);
    await runEngineFreeze(f.db.app, { now: AT.dec2, tenantId: A, allowFakeClock: true });

    const december = await forecastRows(A, DEC);
    expect(december).toHaveLength(3);
    for (const row of december)
      expect((row.predicted as { band: string }).band, row.machine_id).toBe('Hot');

    // One Hot row is scrapped before the run: the raise seam refuses it, the job skips it and does not fail.
    await f.admin.query("UPDATE machine SET status = 'scrapped' WHERE id = $1", [M_EXTRA]);

    const result = await runEngineRun(f.db.app, {
      now: AT.dec2,
      tenantId: A,
      allowFakeClock: true,
    });
    // December is not scored yet; November is re-scored inside its window.
    expect(result).toEqual({ tenants: 1, scored: 3, raised: 2 });

    const tickets = await inspectionTickets(A);
    expect(tickets).toHaveLength(2);
    expect(tickets.map((ticket) => ticket.machine_id)).toEqual([M_FREE, M_USED]);
    usedTicket = tickets.find((ticket) => ticket.machine_id === M_USED)!;
    freeTicket = tickets.find((ticket) => ticket.machine_id === M_FREE)!;

    const usedRow = december.find((row) => row.machine_id === M_USED)!;
    const usedCode = (
      await f.admin.query('SELECT code FROM machine WHERE tenant_id = $1 AND id = $2', [A, M_USED])
    ).rows[0].code as string;
    expect(usedTicket).toMatchObject({
      kind: 'general',
      status: 'open',
      raised_channel: 'inspection',
      machine_id: M_USED,
      problem: `${usedCode} is Hot for December 2026: plan for ${oneDp((usedRow.predicted as { p80: number }).p80)} hrs`,
    });
    expect(usedTicket.ref).toMatch(/^WR-/);
    expect(await downPayload(A, usedTicket.id as string)).toMatchObject({
      source: { forecast: usedRow.id },
    });

    // The link query reads the raise event back: one ticket per source key, and nothing for an id with none.
    const links = await withTenant(f.db.app, A, (client) =>
      raisedTicketsFor(client, A, 'forecast', [usedRow.id, M_EXTRA]),
    );
    expect(links.get(usedRow.id)).toMatchObject({
      id: usedTicket.id,
      ref: usedTicket.ref,
      status: 'open',
      closeKind: null,
      closedAt: null,
    });
    expect(links.size).toBe(1);

    const audit = await raiseAudit(A);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'inspection.raise',
      entity: 'forecast',
      entity_id: null,
      login_id: null,
      after: { month: DEC, refs: [freeTicket.ref, usedTicket.ref] },
    });
  });

  it('raises nothing a night later, and a cancelled inspection still counts', async () => {
    const cancel = await command(freeTicket.id as string, 'cancel', f.tokens.supervisor!, {
      reason: 'Not needed this month',
    });
    expect(cancel.statusCode).toBe(200);

    const result = await runEngineRun(f.db.app, {
      now: AT.dec3,
      tenantId: A,
      allowFakeClock: true,
    });
    expect(result.raised).toBe(0);
    expect(await inspectionTickets(A)).toHaveLength(2);
    expect(await raiseAudit(A)).toHaveLength(1);
  });

  it('raises nothing for a month that has no frozen Hot row', async () => {
    await runEngineFreeze(f.db.app, { now: AT.dec2, tenantId: B, allowFakeClock: true });
    const result = await runEngineRun(f.db.app, {
      now: AT.dec2,
      tenantId: B,
      allowFakeClock: true,
    });
    expect(result.raised).toBe(0);
    expect(await inspectionTickets(B)).toEqual([]);
  });

  it('stores the inspection’s close state on the forecast row when the month is scored', async () => {
    // The app's own path: a technician picks the inspection up, then marks it done.
    const started = await command(usedTicket.id as string, 'start', f.tokens.supervisor!, {});
    expect(started.statusCode).toBe(200);
    const closed = await command(usedTicket.id as string, 'close', f.tokens.supervisor!, {
      kind: 'done',
    });
    expect(closed.statusCode).toBe(200);
    const storedTicket = (
      await f.admin.query('SELECT closed_at FROM ticket WHERE tenant_id = $1 AND id = $2', [
        A,
        usedTicket.id,
      ])
    ).rows[0];

    const result = await runEngineRun(f.db.app, {
      now: AT.jan4,
      tenantId: A,
      allowFakeClock: true,
    });
    expect(result.scored).toBe(3);

    const rows = await forecastRows(A, DEC);
    const used = rows.find((row) => row.machine_id === M_USED)!;
    expect(used.outcome).toEqual({
      hours: 0,
      episodes: 0,
      hit: true,
      inspection: {
        ticketId: usedTicket.id,
        ref: usedTicket.ref,
        status: 'closed',
        closeKind: 'done',
        closedAt: (storedTicket.closed_at as Date).toISOString(),
      },
    });
    const free = rows.find((row) => row.machine_id === M_FREE)!;
    expect(free.outcome).toMatchObject({
      inspection: { ticketId: freeTicket.id, status: 'cancelled', closeKind: null, closedAt: null },
    });
    const scrapped = rows.find((row) => row.machine_id === M_EXTRA)!;
    expect(scrapped.outcome).toMatchObject({ inspection: null });
    expect(await scoreAudit(A, DEC)).toHaveLength(1);
    // R14: the run writes no kpi_snapshot, not even a plant-level row.
    const snapshots = (
      await f.admin.query('SELECT count(*)::int AS n FROM kpi_snapshot WHERE tenant_id = $1', [A])
    ).rows[0].n;
    expect(snapshots).toBe(0);
  });
});
