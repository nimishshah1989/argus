import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import AxeBuilder from '@axe-core/playwright';
import { apiFetch, apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';

async function expectAccessible(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .include('section[aria-label="Tags"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    result.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    ),
  ).toEqual([]);
}

function tagButton(page: Page, label: string) {
  return page
    .getByRole('region', { name: 'Tags' })
    .getByRole('button', { name: label, exact: true });
}

async function expectMutationError(page: Page): Promise<void> {
  await page.route('**/api/v1/tickets/*/tags', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: '{"error":{"message":"Internal error"}}',
        })
      : route.continue(),
  );
  await tagButton(page, 'Electrical').click();
  await expect(page.getByRole('alert')).toHaveText('Internal error');
  await expectAccessible(page);
  await page.unroute('**/api/v1/tickets/*/tags');
}

async function setConfiguredTag(code: string, label: string, active: boolean): Promise<void> {
  const token = await apiLogin('admin');
  const response = await apiFetch(`/api/v1/lists/work_type/${code}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ label, active }),
  });
  expect(response.status).toBe(200);
}

async function addPreventive(token: string, ticketId: string): Promise<void> {
  const catalogue = await apiFetch('/api/v1/tags', {
    headers: { authorization: `Bearer ${token}` },
  });
  const tag = (await catalogue.json()).tags.find(
    (item: { code: string }) => item.code === 'preventive',
  );
  const response = await apiFetch(`/api/v1/tickets/${ticketId}/tags`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': randomUUID(),
    },
    body: JSON.stringify({ tagId: tag.id }),
  });
  expect(response.status).toBe(200);
}

test('adds, persists and removes configured tags from an empty ticket', async ({
  page,
}, testInfo) => {
  const code = `retirable-${testInfo.project.name}`;
  const label = `Retirable ${testInfo.project.name}`;
  await setConfiguredTag(code, label, true);
  const token = await apiLogin('asha');
  const ticket = await raiseTicketViaApi(token, null, 'Tag test work request');

  await signIn(page, 'asha');
  await page.goto('/desk');
  await page.getByRole('link', { name: new RegExp(ticket.ref) }).click();
  const panel = page.getByRole('region', { name: 'Tags' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('No tags yet.')).toBeVisible();
  await expectAccessible(page);

  const configured = tagButton(page, label);
  const mechanical = tagButton(page, 'Mechanical');
  await expect(configured).toHaveAttribute('aria-pressed', 'false');
  await configured.click();
  await expect(configured).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(tagButton(page, label)).toHaveAttribute('aria-pressed', 'true');
  await expectAccessible(page);

  await tagButton(page, 'Mechanical').click();
  await expect(mechanical).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(tagButton(page, label)).toHaveAttribute('aria-pressed', 'true');
  await expect(tagButton(page, 'Mechanical')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('ol').getByText(`Tag added: ${label}`)).toBeVisible();

  await setConfiguredTag(code, label, false);
  await page.reload();
  const retired = tagButton(page, label);
  await expect(retired).toHaveAttribute('aria-pressed', 'true');

  const [removeResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/tickets/') &&
        ['POST', 'DELETE'].includes(response.request().method()),
    ),
    retired.click(),
  ]);
  expect(removeResponse.request().method()).toBe('DELETE');
  expect(removeResponse.status()).toBe(200);
  await expect(configured).toHaveCount(0);
  await page.reload();
  const [mechanicalResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/tickets/') && response.request().method() === 'DELETE',
    ),
    tagButton(page, 'Mechanical').click(),
  ]);
  expect(mechanicalResponse.status()).toBe(200);
  expect((await mechanicalResponse.json()).applied).toEqual([]);
  await expect(mechanical).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Tags' }).getByText('No tags yet.')).toBeVisible();
  await expect(page.locator('ol').getByText('Tag removed: Mechanical')).toBeVisible();

  await expectMutationError(page);
});

test('waits for applied tags before enabling editing', async ({ page }) => {
  const token = await apiLogin('asha');
  const ticket = await raiseTicketViaApi(token, null, 'Loading state work request');
  await addPreventive(token, ticket.id);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/tickets/*/tags', async (route) => {
    await gate;
    await route.continue();
  });

  await signIn(page, 'asha');
  await page.goto(`/desk/${ticket.id}`);
  const panel = page.getByRole('region', { name: 'Tags' });
  await expect(panel.getByRole('status')).toHaveText('Loading tags…');
  await expect(panel.getByText('No tags yet.')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Preventive', exact: true })).toHaveCount(0);

  release();
  await expect(panel.getByRole('button', { name: 'Preventive', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.unroute('**/api/v1/tickets/*/tags');
});

test('keeps applied tags readable but not editable for read-only roles', async ({ page }) => {
  const token = await apiLogin('asha');
  const ticket = await raiseTicketViaApi(token, null, 'Read-only tag work request');
  await addPreventive(token, ticket.id);

  await signIn(page, 'op');
  await page.goto(`/desk/${ticket.id}`);
  const panel = page.getByRole('region', { name: 'Tags' });
  await expect(panel.getByText('Preventive', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Preventive', exact: true })).toHaveCount(0);
  await expectAccessible(page);
});
