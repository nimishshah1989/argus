import { expect, test } from './test.js';
import { actionMachines, commandViaApi, getJson } from './fixtures-actions.js';
import { apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';

/**
 * Open and the ticket side by side (slice 4 D5): from 1024 px a ticket opens beside the list, on a phone it
 * opens as its own page. Tickets are raised through the API; every name is a fake.
 */
test.describe.configure({ mode: 'serial' });

const problem = 'Two-pane: coolant pump is humming';
const seeded = {} as { id: string; ref: string };
const request = {} as { id: string; ref: string };
const tokens = {} as Record<'op' | 'admin', string>;

test.beforeAll(async () => {
  for (const login of ['op', 'admin'] as const) tokens[login] = await apiLogin(login);
  const created = await raiseTicketViaApi(tokens.op, actionMachines().a.id, problem);
  Object.assign(seeded, created);
  Object.assign(request, await raiseTicketViaApi(tokens.op, null, 'Two-pane: tidy the tool crib'));
});

test.afterAll(async () => {
  const me = await getJson<{ user: { actingPersonId: string } }>(tokens.admin, '/api/v1/auth/me');
  for (const ticket of [seeded, request]) {
    await commandViaApi(tokens.admin, ticket.id, 'cancel', {
      personId: me.user.actingPersonId,
      reason: 'Two-pane spec cleanup',
    });
  }
});

test('a ticket opens beside the list on a wide screen and as its own page on a phone', async ({
  page,
  isMobile,
}) => {
  await signIn(page, 'asha');
  await page.goto('/desk');
  const card = page.getByRole('link', { name: new RegExp(seeded.ref) });
  await expect(card).toBeVisible();

  if (isMobile) {
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/desk/${seeded.id}$`));
    await expect(page.getByRole('heading', { name: seeded.ref })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(seeded.ref) })).toHaveCount(0);
    return;
  }

  await expect(page.getByText('Pick a ticket on the left to see it here.')).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/desk/${seeded.id}$`));
  await expect(page.getByRole('heading', { name: seeded.ref })).toBeVisible();
  await expect(page.getByText(problem).first()).toBeVisible();
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('aria-current', 'page');
  const deskHeader = await page.locator('header').first().boundingBox();
  const pane = await page.getByRole('region', { name: 'Ticket' }).boundingBox();
  expect(pane!.y).toBeGreaterThanOrEqual(deskHeader!.y + deskHeader!.height);
  await expect(page.getByText('Pick a ticket on the left to see it here.')).toHaveCount(0);

  await page.getByRole('link', { name: 'Open tickets' }).click();
  await expect(page).toHaveURL(/\/desk$/);
  await expect(page.getByText('Pick a ticket on the left to see it here.')).toBeVisible();
  await expect(card).not.toHaveAttribute('aria-current', 'page');

  await page.getByRole('button', { name: /^Work \(\d+\)$/ }).click();
  await page.getByRole('link', { name: new RegExp(request.ref) }).click();
  await expect(page).toHaveURL(new RegExp(`/desk/${request.id}$`));
  await expect(page.getByRole('heading', { name: request.ref })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Work \(\d+\)$/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
