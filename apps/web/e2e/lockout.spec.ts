import { randomUUID } from 'node:crypto';
import { expect, test } from './test.js';
import { apiFetch, apiLogin, signIn, ticketView } from './fixtures.js';

/**
 * Ticket 66, slice 7: a ticket flagged "needs lockout" will not start until the person ticks every step.
 * Every ticket locator goes through `ticketView`: the Open list beside the pane repeats each card's
 * "Start work", so an unscoped one matches a card as well as the ticket.
 */

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

  const view = ticketView(page);
  await expect(view.getByRole('heading', { name: 'Lockout before you start' })).toBeVisible();
  const start = view.getByRole('button', { name: 'Start work' });
  await expect(start).toBeDisabled();
  await expect(view.getByText('Tick all 4 steps to start.')).toBeVisible();

  for (const step of FOUR_STEPS.slice(0, 3)) await view.getByLabel(step).check();
  await expect(start).toBeDisabled();

  await view.getByLabel(FOUR_STEPS[3]!).check();
  await expect(start).toBeEnabled();
  await start.click();

  await expect(view.getByText('Lockout confirmed').first()).toBeVisible();
  await expect(view.getByRole('button', { name: 'Pause: waiting' })).toBeVisible();
});

test('pausing after a start clears the ticks, so Resume waits for every step again', async ({
  page,
}) => {
  const ticket = await flaggedTicket();
  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);

  const view = ticketView(page);
  for (const step of FOUR_STEPS) await view.getByLabel(step).check();
  await view.getByRole('button', { name: 'Start work' }).click();
  await expect(view.getByText('Lockout confirmed').first()).toBeVisible();

  await view.getByRole('button', { name: 'Pause: waiting' }).click();
  const form = view.getByRole('form', { name: 'Pause the ticket' });
  await form.getByLabel('Waiting for').selectOption('spare');
  await form.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(form).toBeHidden();

  // The server cleared the confirmation at the pause: Resume must ask for every step again.
  await expect(view.getByRole('button', { name: 'Resume work' })).toBeDisabled();
  for (const step of FOUR_STEPS) await expect(view.getByLabel(step)).not.toBeChecked();
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
  const view = ticketView(page);
  for (const step of FOUR_STEPS) await view.getByLabel(step).check();
  await view.getByRole('button', { name: 'Resume work' }).click();

  // Asha's own confirmation goes through; Resume is refused because Bina has not confirmed since the pause.
  await expect(view.getByText('Lockout confirmed').first()).toBeVisible();
  await expect(view.getByText('Lockout refused').first()).toBeVisible();
  await expect(view.getByText(/Still to confirm:.*Bina/)).toBeVisible();
});

test('the refusal goes once the retried Resume succeeds through the page', async ({ page }) => {
  const ticket = await flaggedTicket();
  const asha = await apiLogin('asha');
  const bina = await apiLogin('bina');
  const stepCodes = await stepCodesOf(asha, ticket.id);

  await postCommand(asha, ticket.id, 'lockout-confirm', { stepCodes });
  await postCommand(asha, ticket.id, 'start', {});
  await postCommand(bina, ticket.id, 'lockout-confirm', { stepCodes });
  await postCommand(bina, ticket.id, 'join', { role: 'support' });
  await postCommand(asha, ticket.id, 'pause', { reasonCode: 'spare' });

  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);
  const view = ticketView(page);
  for (const step of FOUR_STEPS) await view.getByLabel(step).check();
  await view.getByRole('button', { name: 'Resume work' }).click();
  await expect(view.getByText('Lockout refused').first()).toBeVisible();

  // Bina confirms after the pause. Asha's own confirmation already stands, so Resume needs no gate and
  // goes through the page's own command path; the refusal it left behind is stale and must go.
  await postCommand(bina, ticket.id, 'lockout-confirm', { stepCodes });
  await view.getByRole('button', { name: 'Resume work' }).click();
  await expect(view.getByRole('button', { name: 'Pause: waiting' })).toBeVisible();
  await expect(view.getByText('Lockout refused')).toHaveCount(0);
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
  await expect(
    ticketView(page).getByRole('heading', { name: 'Lockout before you start' }),
  ).toBeVisible();
});

test('the busy button names the action it is confirming, not always starting', async ({ page }) => {
  const ticket = await flaggedTicket();
  const asha = await apiLogin('asha');
  const stepCodes = await stepCodesOf(asha, ticket.id);
  await postCommand(asha, ticket.id, 'lockout-confirm', { stepCodes });
  await postCommand(asha, ticket.id, 'start', {});
  await postCommand(asha, ticket.id, 'pause', { reasonCode: 'spare' });

  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);
  const view = ticketView(page);
  for (const step of FOUR_STEPS) await view.getByLabel(step).check();

  // Hold the confirmation in flight so the label is readable without a race.
  await page.route('**/api/v1/tickets/*/lockout-confirm', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await view.getByRole('button', { name: 'Resume work' }).click();
  await expect(view.getByRole('button', { name: /Confirming and resuming/ })).toBeVisible();
  await expect(view.getByText('Lockout confirmed').first()).toBeVisible();
});

test('another technician has to confirm for themselves before joining', async ({ page }) => {
  const ticket = await flaggedTicket();
  const asha = await apiLogin('asha');
  const bina = await apiLogin('bina');
  const stepCodes = await stepCodesOf(asha, ticket.id);
  await postCommand(asha, ticket.id, 'lockout-confirm', { stepCodes });
  await postCommand(asha, ticket.id, 'start', {});

  await signIn(page, 'bina');
  await page.goto(`/desk/${ticket.id}`);
  const view = ticketView(page);
  const join = view.getByRole('button', { name: 'Add me as support' });
  await expect(join).toBeDisabled();
  for (const step of FOUR_STEPS) await view.getByLabel(step).check();
  await expect(join).toBeEnabled();
  await join.click();
  const form = view.getByRole('form', { name: 'Add me as crew' });
  await form.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(form).toBeHidden();

  // Joining is Bina's own confirmation plus the crew row, not just a button that turns enabled.
  const me = await apiFetch('/api/v1/auth/me', { headers: json(bina) });
  const { user } = (await me.json()) as { user: { actingPersonId: string } };
  const read = await apiFetch(`/api/v1/tickets/${ticket.id}`, { headers: json(bina) });
  const detail = (await read.json()) as {
    ticket: { lockout: { confirmations: { byPersonId: string }[] } };
    people: { personId: string; role: string; leftAt: string | null }[];
  };
  expect(detail.people).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ personId: user.actingPersonId, role: 'support', leftAt: null }),
    ]),
  );
  expect(detail.ticket.lockout.confirmations.map((entry) => entry.byPersonId)).toContain(
    user.actingPersonId,
  );
});
