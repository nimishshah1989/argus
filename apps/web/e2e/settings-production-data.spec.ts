import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { MACHINES, apiFetch, apiLogin, signIn } from './fixtures.js';

/** Ticket 77b: Settings -> Machines can leave a machine out of production data; the change is saved and survives a reload. */

const SWITCH = (code: string) => `Not counted in production data: ${code}`;
/** The kit table shows ten rows a page (ADR 0036); the plant has more machines, so a journey searches for its own. */
const find = (page: Page, code: string) =>
  page.getByRole('searchbox', { name: 'Search code or type', exact: true }).fill(code);

test('an admin switches a machine out of production data and it stays out after a reload', async ({
  page,
}, testInfo) => {
  const wide = testInfo.project.name === 'chromium';
  const machine = MACHINES[wide ? 6 : 7]!;
  if (wide) await page.setViewportSize({ width: 1440, height: 900 });
  else await page.setViewportSize({ width: 360, height: 800 });
  await signIn(page, 'admin');
  await page.goto('/settings/machines');
  await expect(
    page.getByText('Its breakdowns are still recorded and count in manpower hours', {
      exact: false,
    }),
  ).toBeVisible();

  await find(page, machine.code);
  const toggle = page.getByRole('switch', { name: SWITCH(machine.code), exact: true });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  const box = await toggle.boundingBox();
  if (!box) throw new Error('Visible switch has no bounding box');
  expect(box.height).toBeGreaterThanOrEqual(44);
  await toggle.focus();
  await page.keyboard.press('Space');

  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Not in production data', { exact: true })).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: '1 machine not counted', exact: true }),
  ).toBeVisible();

  await page.reload();
  await find(page, machine.code);
  const again = page.getByRole('switch', { name: SWITCH(machine.code), exact: true });
  await expect(again).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Not in production data', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: '1 machine not counted', exact: true }).click();
  await expect(page.getByRole('switch')).toHaveCount(1);

  await page.getByRole('button', { name: '1 machine not counted', exact: true }).click();
  await again.click(); // back in: leaves the plant as the other journeys expect it
  await expect(again).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('button', { name: /not counted/ })).toHaveCount(0);
});

test('a failed save puts the switch back and says so', async ({ page }, testInfo) => {
  const machine = MACHINES[testInfo.project.name === 'chromium' ? 8 : 9]!;
  await page.route('**/api/v1/machines/*/production-data', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );
  await signIn(page, 'admin');
  await page.goto('/settings/machines');
  await find(page, machine.code);
  const toggle = page.getByRole('switch', { name: SWITCH(machine.code), exact: true });
  await toggle.click();
  await expect(page.getByRole('alert').filter({ hasText: machine.code })).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('an operator does not get the switch, and the server refuses the change', async ({
  page,
}, testInfo) => {
  const machine = MACHINES[testInfo.project.name === 'chromium' ? 6 : 7]!;
  await signIn(page, 'op');
  await page.goto('/settings/machines');
  await expect(page.getByText('No settings access', { exact: true })).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(0);
  const token = await apiLogin('op');
  const reply = await apiFetch(`/api/v1/machines/${machine.id}/production-data`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ excludedFromProduction: true }),
  });
  expect(reply.status).toBe(403);
});
