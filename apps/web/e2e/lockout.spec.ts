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

/** A work type flagged "needs lockout" of its own, so the spec leaves the plant's lists as it found them. */
async function flaggedTicket(): Promise<{ id: string; ref: string }> {
  const head = await apiLogin('head');
  const workType = `Lockout ${randomUUID().slice(0, 8)}`;
  const made = await apiFetch('/api/v1/lists/work_type', {
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
