import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { SEGMENT, apiFetch, apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';
import { ensureSlaConfiguration } from './sla-test-helpers.js';

/**
 * Ticket 31, browser half: the acknowledge button leads the action bar for the person on duty, the desk card says
 * the ladder's state, the history says who was told and how fast they answered, and a plant with no ladder reads
 * "Escalation due, nobody told". Everything is fake seeded data; the escalation is real, fired by a breached clock.
 */
test.describe.configure({ mode: 'serial' });

const MINUTE = 60_000;
/** The plant date (Asia/Kolkata, the seeded plant's zone) for a roster line that the running shift reads. */
const plantToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

interface Init {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function json<T>(token: string, path: string, init: Init = {}): Promise<T> {
  const res = await apiFetch(path, {
    ...(init.method ? { method: init.method } : {}),
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  if (!res.ok)
    throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

interface Machine {
  id: string;
}

interface Rule {
  id: string;
  trigger: string;
  active: boolean;
}

interface RosterLine {
  id: string;
  date: string;
  personId: string;
  level: string;
}

interface TicketState {
  ticket: {
    escalation?: { pendingLevels: string[]; lastLevel: string | null };
  };
  events: Array<{ type: string; escalation: { level: string } | null }>;
}

const RULE_ACK = {
  trigger: 'ack_missed',
  severityMin: 'S3',
  level: 'L2',
  channel: 'push',
  delayMinutes: 0,
  repeatMinutes: 30,
  repeatCap: 3,
  active: true,
};

/** One machine of this spec's own, critical enough (A) that a stopped ticket is S1 and the ladder covers it. */
async function createMachine(admin: string): Promise<Machine> {
  return json<Machine>(admin, '/api/v1/machines', {
    method: 'POST',
    body: {
      code: `ES-${randomUUID().slice(0, 6)}`,
      category: 'VMC',
      cell: 'Cell-6',
      criticality: 'A',
      segmentId: SEGMENT.id,
    },
  });
}

async function shiftIdOf(admin: string): Promise<string> {
  const page = await json<{ items: Array<{ id: string; code: string }> }>(admin, '/api/v1/shifts');
  const shift = page.items.find((item) => item.code === 'e2e') ?? page.items[0];
  if (!shift) throw new Error('The seeded plant has no shift');
  return shift.id;
}

async function rules(admin: string): Promise<Rule[]> {
  return (await json<{ items: Rule[] }>(admin, '/api/v1/escalation-rules')).items;
}

/** Only the acknowledge rule fires: a correction breaches every clock at once, and one ladder is the subject. */
async function onlyAckRule(admin: string): Promise<Rule> {
  const all = await rules(admin);
  for (const rule of all) {
    if (rule.trigger !== 'ack_missed' && rule.active)
      await json(admin, `/api/v1/escalation-rules/${rule.id}`, {
        method: 'PUT',
        body: { active: false },
      });
  }
  const ack = all.find((rule) => rule.trigger === 'ack_missed');
  if (!ack) throw new Error('The seeded ladder has no missed-acknowledge rule');
  return ack;
}

async function editRule(admin: string, id: string, body: Record<string, unknown>): Promise<void> {
  await json(admin, `/api/v1/escalation-rules/${id}`, {
    method: 'PUT',
    body: { ...RULE_ACK, ...body },
  });
}

async function roster(admin: string): Promise<RosterLine[]> {
  return (await json<{ items: RosterLine[] }>(admin, '/api/v1/roster')).items;
}

async function clearRoster(admin: string): Promise<void> {
  const today = plantToday();
  for (const line of await roster(admin)) {
    if (line.date !== today) continue;
    await json(admin, `/api/v1/roster/${line.id}`, { method: 'PUT', body: { active: false } });
  }
}

/** The on-duty technician's line for the shift running now, at the level the rule tells. */
async function putOnDuty(admin: string, personId: string, shiftId: string): Promise<void> {
  const date = plantToday();
  const mine = (await roster(admin)).find(
    (line) => line.date === date && line.personId === personId && line.level === 'L2',
  );
  if (mine) return;
  await json(admin, '/api/v1/roster', {
    method: 'POST',
    body: { date, shiftId, personId, level: 'L2' },
  });
}

async function personIdOf(token: string): Promise<string> {
  const me = await json<{ user: { actingPersonId: string } }>(token, '/api/v1/auth/me');
  return me.user.actingPersonId;
}

/** Two days old, so the acknowledge clock is well past its minute target and the ladder is due. */
async function breachAckClock(admin: string, ticketId: string): Promise<void> {
  await json(admin, `/api/v1/tickets/${ticketId}/correct`, {
    method: 'POST',
    headers: { 'idempotency-key': randomUUID() },
    body: {
      reason: 'Breach the acknowledge clock for the ladder',
      changes: { reportedAt: new Date(Date.now() - 2 * 24 * 60 * MINUTE).toISOString() },
    },
  });
}

const detail = (token: string, ticketId: string) =>
  json<TicketState>(token, `/api/v1/tickets/${ticketId}`);

/** The worker writes the step a moment after the breach; the API is what the history will show. */
async function expectStep(admin: string, ticketId: string): Promise<void> {
  await expect
    .poll(async () => (await detail(admin, ticketId)).events.some((e) => e.type === 'escalate'), {
      timeout: 30_000,
    })
    .toBe(true);
}

const actionButtons = (page: Page) =>
  page.getByRole('region', { name: 'Actions', exact: true }).getByRole('button');

test('the on-duty person acknowledges first and the desk card shows the ladder waiting', async ({
  page,
}) => {
  const admin = await ensureSlaConfiguration();
  const machine = await createMachine(admin);
  const shiftId = await shiftIdOf(admin);
  const rule = await onlyAckRule(admin);
  await editRule(admin, rule.id, { notifyRole: 'supervisor', notifyPersonId: null });
  await clearRoster(admin);
  await putOnDuty(admin, await personIdOf(await apiLogin('asha')), shiftId);

  const ticket = await raiseTicketViaApi(await apiLogin('asha'), machine.id, 'Acknowledge ladder');
  await breachAckClock(admin, ticket.id);
  await expectStep(admin, ticket.id);
  expect((await detail(admin, ticket.id)).ticket.escalation?.pendingLevels).toEqual(['L2']);

  await signIn(page, 'asha');
  await page.goto('/desk');
  const card = page.getByRole('link', { name: new RegExp(ticket.ref) });
  await expect(card).toContainText('Escalation · L2 waiting');
  await card.click();

  await expect(actionButtons(page).first()).toHaveText('Acknowledge');
  await expect(actionButtons(page).nth(1)).toHaveText('Start work');

  // An off-roster operator: the ticket opens, but neither acknowledge nor start is on offer.
  await signIn(page, 'op');
  await page.goto(`/desk/${ticket.id}`);
  await expect(page.getByText('Acknowledge ladder', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acknowledge', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start work', exact: true })).toHaveCount(0);

  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);
  await page.getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await expect(page.getByText(/Acknowledged by/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acknowledge', exact: true })).toHaveCount(0);
});

test('a plant with nobody on the ladder reads "Escalation due, nobody told"', async ({ page }) => {
  const admin = await ensureSlaConfiguration();
  const machine = await createMachine(admin);
  const rule = await onlyAckRule(admin);
  // A named person with no login of their own: the roster and the role are empty, so the step says no ladder.
  const gap = await json<{ id: string }>(admin, '/api/v1/people', {
    method: 'POST',
    body: { name: 'Ladder gap', team: 'maintenance' },
  });
  await editRule(admin, rule.id, { notifyPersonId: gap.id, notifyRole: null });
  await clearRoster(admin);

  const ticket = await raiseTicketViaApi(await apiLogin('asha'), machine.id, 'No ladder at all');
  await breachAckClock(admin, ticket.id);
  await expectStep(admin, ticket.id);

  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);
  await expect(page.getByText('Escalation due, nobody told')).toBeVisible();
});
