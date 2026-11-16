import { randomUUID } from 'node:crypto';
import { expect, test } from './test.js';
import { apiFetch, apiLogin, signIn } from './fixtures.js';

/** Ticket 66, slice 7: a ticket flagged "needs lockout" will not start until the person ticks every step. */

const FOUR_STEPS = [
  'Switch off and isolate the supply',
  'Lock and tag the isolator',
  'Test that it is dead',
  'Tell the people nearby',
];

const json = (token: string, key = randomUUID()) => ({
  'content-type': 'application/json',
  authorization: `Bearer ${token}`,
  'idempotency-key': key,
});

/** A command through the API, for the setup another person's confirmation needs. */
async function postCommand(
  token: string,
  ticketId: string,
  action: string,
  body: object,
): Promise<void> {
  const sent = await apiFetch(`/api/v1/tickets/${ticketId}/${action}`, {
    method: 'POST',
    headers: json(token),
    body: JSON.stringify(body),
  });
  expect(sent.status).toBe(200);
}

async function stepCodesOf(token: string, ticketId: string): Promise<string[]> {
  const read = await apiFetch(`/api/v1/tickets/${ticketId}`, { headers: json(token) });
  const { ticket } = (await read.json()) as { ticket: { lockout: { steps: { code: string }[] } } };
  return ticket.lockout.steps.map((step) => step.code);
}

/** A work type flagged "needs lockout" of its own, so the spec leaves the plant's lists as it found them. */
async function flaggedTicket(): Promise<{ id: string; ref: string }> {
  const head = await apiLogin('head');
  const workType = `Lockout ${randomUUID().slice(0, 8)}`;
  const made = await apiFetch('/api/v1/settings/lists/work_type', {
    method: 'POST',
    headers: json(head),
    body: JSON.stringify({ code: workType, label: workType, needsLockout: true }),
  });
  expect(made.status).toBe(201);
  const raised = await apiFetch('/api/v1/tickets', {
    method: 'POST',
    headers: json(head),
    body: JSON.stringify({
      kind: 'general',
      location: 'Boiler house',
      workType,
      problem: 'Panel humming',
    }),
  });
  expect(raised.status).toBe(201);
  return ((await raised.json()) as { ticket: { id: string; ref: string } }).ticket;
}

test('Start stays off until every lockout step is ticked, then confirms and starts', async ({
  page,
}) => {
  const ticket = await flaggedTicket();
  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);

  await expect(page.getByRole('heading', { name: 'Lockout before you start' })).toBeVisible();
  const start = page.getByRole('button', { name: 'Start work' });
  await expect(start).toBeDisabled();
  await expect(page.getByText('Tick all 4 steps to start.')).toBeVisible();

  for (const step of FOUR_STEPS.slice(0, 3)) await page.getByLabel(step).check();
  await expect(start).toBeDisabled();

  await page.getByLabel(FOUR_STEPS[3]!).check();
  await expect(start).toBeEnabled();
  await start.click();

  await expect(page.getByText('Lockout confirmed').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause: waiting' })).toBeVisible();
});

test('pausing after a start clears the ticks, so Resume waits for every step again', async ({
  page,
}) => {
  const ticket = await flaggedTicket();
  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);

  for (const step of FOUR_STEPS) await page.getByLabel(step).check();
  await page.getByRole('button', { name: 'Start work' }).click();
  await expect(page.getByText('Lockout confirmed').first()).toBeVisible();

  await page.getByRole('button', { name: 'Pause: waiting' }).click();
  const form = page.getByRole('form', { name: 'Pause the ticket' });
  await form.getByLabel('Waiting for').selectOption('spare');
  await form.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(form).toBeHidden();

  // The server cleared the confirmation at the pause: Resume must ask for every step again.
  await expect(page.getByRole('button', { name: 'Resume work' })).toBeDisabled();
  for (const step of FOUR_STEPS) await expect(page.getByLabel(step)).not.toBeChecked();
});

test('a refused Resume keeps saying who is still to confirm', async ({ page }) => {
  const ticket = await flaggedTicket();
  const asha = await apiLogin('asha');
  const bina = await apiLogin('bina');
  const stepCodes = await stepCodesOf(asha, ticket.id);

  // Asha starts, Bina joins the work, then Asha pauses: that clears both confirmations.
  await postCommand(asha, ticket.id, 'lockout-confirm', { stepCodes });
  await postCommand(asha, ticket.id, 'start', {});
  await postCommand(bina, ticket.id, 'lockout-confirm', { stepCodes });
  await postCommand(bina, ticket.id, 'join', { role: 'support' });
  await postCommand(asha, ticket.id, 'pause', { reasonCode: 'spare' });

  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);
  for (const step of FOUR_STEPS) await page.getByLabel(step).check();
  await page.getByRole('button', { name: 'Resume work' }).click();

  // Asha's own confirmation goes through; Resume is refused because Bina has not confirmed since the pause.
  await expect(page.getByText('Lockout confirmed').first()).toBeVisible();
  await expect(page.getByText('Lockout refused').first()).toBeVisible();
  await expect(page.getByText(/Still to confirm:.*Bina/)).toBeVisible();
});

test('a flagged ticket card routes to the ticket instead of a quick Start', async ({ page }) => {
  const ticket = await flaggedTicket();
  await signIn(page, 'asha');
  await page.goto('/desk');
  await page.getByRole('button', { name: /^Work \(/ }).click();

  const card = page.getByRole('listitem').filter({ hasText: ticket.ref });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: 'Start work' })).toHaveCount(0);

  await card.getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Lockout before you start' })).toBeVisible();
});

test('another technician has to confirm for themselves before joining', async ({ page }) => {
  const ticket = await flaggedTicket();
  const asha = await apiLogin('asha');
  const read = await apiFetch(`/api/v1/tickets/${ticket.id}`, { headers: json(asha) });
  const { ticket: full } = (await read.json()) as {
    ticket: { lockout: { steps: { code: string }[] } };
  };
  const stepCodes = full.lockout.steps.map((step) => step.code);
  for (const [action, body] of [
    ['lockout-confirm', { stepCodes }],
    ['start', {}],
  ] as const) {
    const sent = await apiFetch(`/api/v1/tickets/${ticket.id}/${action}`, {
      method: 'POST',
      headers: json(asha),
      body: JSON.stringify(body),
    });
    expect(sent.status).toBe(200);
  }

  await signIn(page, 'bina');
  await page.goto(`/desk/${ticket.id}`);
  await expect(page.getByRole('button', { name: 'Add me as support' })).toBeDisabled();
  for (const step of FOUR_STEPS) await page.getByLabel(step).check();
  await expect(page.getByRole('button', { name: 'Add me as support' })).toBeEnabled();
});
