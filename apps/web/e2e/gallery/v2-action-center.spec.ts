import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const FIRST = 'HMC-2 has broken down 12 times in 30 days';
const drawer = (page: Page) => page.locator('aside.v2-drawer');
const nudges = (page: Page) => page.getByRole('region', { name: 'Nudges', exact: true });
const tabs = (page: Page) => page.getByRole('group', { name: 'Action Center status' });

async function open(page: Page, width: number, theme = 'light') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-action-center&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Action Center' })).toBeVisible();
  await expect(page.locator('.v2-lede')).toContainText('5 high-priority and 26 medium nudges');
}

for (const width of [1440, 390]) {
  test(`${width} px: the four counts, a nudge opens the drawer, Back closes it, the list filters, nothing scrolls sideways`, async ({
    page,
  }) => {
    await open(page, width);
    for (const [name, value] of [
      ['High priority', '5'],
      ['Medium', '26'],
      ['Low', '2'],
      ['Good news', '0'],
    ] as const)
      await expect(page.getByRole('region', { name, exact: true })).toContainText(value);
    await nudges(page)
      .getByRole('button', { name: `Open ${FIRST}` })
      .click();
    await expect(drawer(page)).toHaveAttribute('aria-label', FIRST);
    await expect(page).toHaveURL(/drawer=decision:freq~HMC-2/);
    await expect(drawer(page).getByRole('button', { name: 'Acknowledge' })).toBeVisible();
    await page.goBack();
    await expect(drawer(page)).toHaveAttribute('inert', '');
    await expect(nudges(page).getByText('1–10 of 33')).toBeVisible();
    await nudges(page).getByRole('button', { name: 'High priority' }).click();
    await expect(nudges(page).getByText('1–5 of 5')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });
}

test('the four status tabs, the type filter and the search narrow the list; an empty one says so', async ({
  page,
}) => {
  await open(page, 1440);
  await page.getByLabel('Type', { exact: true }).selectOption('recur');
  await expect(nudges(page).getByText('1–1 of 1')).toBeVisible();
  await page.getByLabel('Type', { exact: true }).selectOption('');
  await nudges(page).getByRole('searchbox').fill('vc-14');
  await expect(nudges(page).getByText('1–1 of 1')).toBeVisible();
  await nudges(page).getByRole('searchbox').fill('');
  await tabs(page)
    .getByRole('button', { name: /^Acknowledged/ })
    .click();
  const row = nudges(page).getByRole('row').filter({ hasText: 'TC-3 has broken down' });
  for (const text of ['Acknowledged', 'Asha', 'Due 20-Nov-2026', 'Note: Check the bearing'])
    await expect(row).toContainText(text);
  await tabs(page)
    .getByRole('button', { name: /^Snoozed/ })
    .click();
  await expect(nudges(page)).toContainText('Snoozed until 18-Nov-2026');
  await tabs(page)
    .getByRole('button', { name: /^Resolved/ })
    .click();
  await nudges(page).getByRole('searchbox').fill('no such machine');
  await expect(nudges(page)).toContainText('Nothing here.');
});

test('the form of an open nudge is in the drawer; a stored one offers Reopen', async ({ page }) => {
  await open(page, 1440);
  await nudges(page)
    .getByRole('button', { name: `Open ${FIRST}` })
    .click();
  await drawer(page).getByRole('button', { name: 'Acknowledge' }).click();
  const form = drawer(page).getByRole('form', { name: 'Acknowledge nudge' });
  await expect(form.getByLabel('Owner')).toBeVisible();
  await expect(form.getByLabel('Due date')).toBeVisible();
  await expect(form.getByLabel('Note')).toBeVisible();
  await expect(drawer(page).getByRole('button', { name: 'Snooze 7 days' })).toBeVisible();
  await page.keyboard.press('Escape');
  await tabs(page)
    .getByRole('button', { name: /^Acknowledged/ })
    .click();
  await nudges(page)
    .getByRole('button', { name: /^Open TC-3 has broken down/ })
    .click();
  await expect(drawer(page).getByRole('button', { name: 'Reopen' })).toBeVisible();
  await expect(drawer(page).getByRole('button', { name: 'Snooze 7 days' })).toHaveCount(0);
});

test('a machine in the risk table opens its drawer; a pasted unknown nudge says not found', async ({
  page,
}) => {
  await open(page, 1440);
  const risk = page.getByRole('region', { name: 'Machines needing attention' });
  await expect(risk.getByRole('row')).toHaveCount(9);
  await risk.getByRole('button', { name: 'HMC-2' }).first().click();
  await expect(page).toHaveURL(/drawer=machine:HMC-2/);
  await page.goto('/gallery?view=v2-action-center&drawer=decision:freq~NOPE');
  await expect(page.locator('[data-state="empty"]')).toBeVisible();
});

for (const theme of ['light', 'dark']) {
  test(`axe finds nothing in ${theme}, with the Why and a drawer open`, async ({ page }) => {
    await open(page, 1440, theme);
    await page.getByRole('button', { name: 'Why?', exact: true }).click();
    await nudges(page)
      .getByRole('button', { name: `Open ${FIRST}` })
      .click();
    await drawer(page).getByRole('button', { name: 'Acknowledge' }).click();
    await expect(drawer(page)).toHaveAttribute('aria-label', FIRST);
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}

test('the loading, empty and error states are designed', async ({ page }) => {
  for (const [state, marker] of [
    ['loading', '[data-state="loading"]'],
    ['empty', '[data-state="empty"]'],
    ['error', '[data-state="error"]'],
  ] as const) {
    await page.goto(`/gallery?view=v2-action-center&state=${state}`);
    await expect(page.locator(marker)).toBeVisible();
  }
});
