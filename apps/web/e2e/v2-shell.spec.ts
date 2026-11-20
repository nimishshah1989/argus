import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { signIn } from './fixtures.js';

/**
 * Ticket 91, the v2 shell: what v1's analytics shell had (the Desk link, the Ctrl K search over every page) and a rail
 * that moves through the router. They run on the Machines register, a v2 screen at its v1 address; the shell is the
 * frame, so what the register shows does not matter and nothing is stubbed.
 */
const SECTIONS = [
  'Today',
  'Machines',
  'Problems',
  'Reliability & forecast',
  'People & money',
  'Reports',
  'Guide',
];
const rail = (page: Page) => page.getByRole('navigation', { name: 'Analytics', exact: true });
const searchButton = (page: Page) => page.getByRole('button', { name: /^Search/ });

async function openMachines(page: Page, username: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, username);
  await page.goto('/analytics/machines');
  await expect(searchButton(page)).toBeVisible();
  // The figures arrive and the screen swaps its loading frame for its own: wait for that before opening anything.
  await page.waitForLoadState('networkidle');
}

test('the Desk link ends the rail for a head, and a click on it opens the desk', async ({
  page,
}) => {
  await openMachines(page, 'head');
  await expect(rail(page).getByRole('link')).toHaveText([...SECTIONS, 'Desk']);
  await expect(rail(page).getByRole('link', { name: 'Machines', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await rail(page).getByRole('link', { name: 'Desk', exact: true }).click();
  await expect(page).toHaveURL(/\/desk(\/|$|\?)/);
});

test('a technician has the Guide and the way out to the desk, and no figures sections', async ({
  page,
}) => {
  await openMachines(page, 'asha');
  await expect(rail(page).getByRole('link')).toHaveText(['Guide', 'Desk']);
});

test('an operator has the Guide alone: no desk to go to', async ({ page }) => {
  await openMachines(page, 'op');
  await expect(rail(page).getByRole('link')).toHaveText(['Guide']);
});

test('Ctrl K opens a search over every page, typing narrows it, Enter goes there and Esc puts focus back', async ({
  page,
}) => {
  await openMachines(page, 'head');
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Search sections and screens', exact: true });
  await expect(palette).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Type a section or screen name' })).toBeFocused();
  await page.keyboard.type('mttr');
  await expect(palette.getByRole('option')).toHaveCount(1);
  await expect(palette.getByRole('option')).toContainText('Screen in Problems');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/analytics\/breakdowns\?screen=a3-mttr-mtbf$/);
  await expect(page.getByRole('heading', { name: 'Problems', exact: true })).toBeVisible();

  await page.goto('/analytics/machines');
  await expect(searchButton(page)).toBeVisible();
  await page.waitForLoadState('networkidle');
  await searchButton(page).click();
  await expect(palette).toBeVisible();
  await page.keyboard.type('zzzz');
  await expect(palette.getByText('Nothing matches')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(palette).toHaveCount(0);
  await expect(searchButton(page)).toBeFocused();
});

test('a rail click goes to the page without loading a new document', async ({ page }) => {
  await openMachines(page, 'head');
  await page.evaluate(() => {
    (window as unknown as { stayed: boolean }).stayed = true;
  });
  await rail(page).getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page).toHaveURL(/\/analytics\/reports$/);
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
});
