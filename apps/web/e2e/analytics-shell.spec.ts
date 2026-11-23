import { expect, test } from './test.js';
import { signIn } from './fixtures.js';

/**
 * Ticket 86a: the approved navigation map on the real analytics screens. The shell is a frame: the screens
 * inside keep their own journeys (the other analytics specs), so this one checks the frame alone. It stands on Reports,
 * a page still in this frame: Today is a v2 screen in the v2 shell, which analytics.spec.ts checks.
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

test('a head sees the six sections and the Guide, tabs inside a section, and a period it cannot change yet', async ({
  page,
}, testInfo) => {
  const wide = testInfo.project.name === 'chromium';
  if (wide) await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'head');
  await page.goto('/analytics/reports');
  if (!wide) await page.getByRole('button', { name: 'Menu', exact: true }).click();

  const menu = page.getByRole('navigation', { name: 'Analytics', exact: true });
  await expect(menu.getByRole('link')).toHaveText([...SECTIONS, 'Desk']);
  await expect(menu.getByRole('link', { name: 'Reports', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // The header carries the period; the figures route takes no period yet, so the picker is shown and off.
  const period = page.getByRole('combobox', { name: 'Period', exact: true });
  await expect(period).toBeDisabled();
  await expect(period).toHaveValue('This year so far');

  // A section's screens are tabs, and People & money marks its own tab on the Team Focus page.
  await menu.getByRole('link', { name: 'People & money', exact: true }).click();
  const tabs = page.getByRole('navigation', { name: 'Screens in People & money', exact: true });
  await expect(tabs.getByRole('link')).toHaveText(['Team Focus', 'Money Matters']);
  await expect(tabs.getByRole('link', { name: 'Team Focus', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await tabs.getByRole('link', { name: 'Money Matters', exact: true }).click();
  await expect(page).toHaveURL(/\/analytics\/cost$/);
  await expect(page.getByRole('heading', { name: 'People & money', exact: true })).toBeVisible();
});

test('Ctrl K opens a search over the real routes and Enter goes there', async ({ page }, info) => {
  if (info.project.name === 'chromium') await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'head');
  await page.goto('/analytics/reports');

  // Wait for the shell to mount so the key listener exists. A phone has no keyboard, so it clicks Search.
  const search = page.getByRole('button', { name: /^Search/ });
  await expect(search).toBeVisible();
  if (info.project.name === 'chromium') await page.keyboard.press('Control+k');
  else await search.click();
  const palette = page.getByRole('dialog', { name: 'Search sections and screens', exact: true });
  await expect(palette).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Type a section or screen name' })).toBeFocused();
  await page.keyboard.type('mttr');
  await expect(palette.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/analytics\/breakdowns\?screen=a3-mttr-mtbf$/);
  await expect(page.getByRole('heading', { level: 1, name: 'MTTR and MTBF' })).toBeVisible();
  // On a phone the rail lives in the menu drawer: open it first.
  if (info.project.name !== 'chromium')
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(
    page
      .getByRole('navigation', { name: 'Analytics', exact: true })
      .getByRole('link', { name: 'Problems', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  if (info.project.name !== 'chromium') await page.keyboard.press('Escape');

  // Esc closes it and the focus goes back to the Search button.
  await page.getByRole('button', { name: /^Search/ }).click();
  await expect(palette).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(palette).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Search/ })).toBeFocused();
});

test('on a phone the menu is a drawer that closes on a choice and on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signIn(page, 'head');
  await page.goto('/analytics/reports');

  const menu = page.getByRole('navigation', { name: 'Analytics', exact: true });
  await expect(menu).toBeHidden();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Today', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await menu.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page).toHaveURL(/\/analytics\/reports$/);
  await expect(menu).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('a login the engine refuses has the Guide and nothing else', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'op');
  await page.goto('/analytics/guide');
  const menu = page.getByRole('navigation', { name: 'Analytics', exact: true });
  await expect(menu.getByRole('link')).toHaveText(['Guide', 'Desk']);
});
