import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PAGE = '/gallery?view=v2-rows-behind';
const PM = 'dashboard.pm-hours';
const drawer = (page: Page) => page.locator('aside.v2-drawer');
const rows = (page: Page) => drawer(page).locator('tbody tr');
const kpi = (page: Page) => page.getByRole('button', { name: /Show the rows behind PM hours/ });
const params = (page: Page) => new URL(page.url()).searchParams;

/** The page on a blank history entry, so "Back" past the first step is visible as leaving the gallery. */
async function open(page: Page, query = '') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('about:blank');
  await page.goto(`${PAGE}${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Rows behind a figure' })).toBeVisible();
  // The pointer starts over the rail, which opens on hover and would cover the first card; park it on the page.
  await page.mouse.move(900, 700);
}
const closed = async (page: Page) => {
  await expect(drawer(page)).toHaveAttribute('inert', '');
  await expect(page).not.toHaveURL(/drawer=/);
};

test('a figure opens the rows behind it from the keyboard; the panel says which figure, its exact value and as of when; Back closes it', async ({
  page,
}) => {
  await open(page);
  await kpi(page).focus();
  await page.keyboard.press('Enter');
  await expect(drawer(page)).toHaveAttribute('aria-label', 'PM hours');
  await expect(page).toHaveURL(new RegExp(`[?&]drawer=figure:${PM.replace('.', '\\.')}$`));
  expect(params(page).get('view')).toBe('v2-rows-behind');
  await expect(drawer(page).getByRole('heading', { level: 2, name: 'PM hours' })).toBeVisible();
  await expect(drawer(page).getByText('759.3 hrs', { exact: true })).toBeVisible();
  await expect(drawer(page).getByText('64 tickets counted')).toBeVisible();
  await expect(drawer(page).getByText(/as of 11-Nov-2026/)).toBeVisible();
  await expect(rows(page)).toHaveCount(10);
  await expect(drawer(page).getByText('1–10 of 64')).toBeVisible();
  await page.goBack();
  await closed(page);
  expect(page.url()).toContain('view=v2-rows-behind');
  await page.goBack();
  expect(page.url()).toBe('about:blank');
});

test('Esc and the ✕ each close it in one history step, and a pasted link opens it', async ({
  page,
}) => {
  await open(page);
  await kpi(page).click();
  await expect(rows(page)).toHaveCount(10);
  await page.keyboard.press('Escape');
  await closed(page);
  await open(page, `&drawer=figure:${PM}`);
  await expect(drawer(page).getByRole('heading', { level: 2, name: 'PM hours' })).toBeVisible();
  await drawer(page).getByRole('button', { name: 'Close' }).click();
  await closed(page);
  await page.goBack();
  expect(page.url()).toBe('about:blank');
});

test('rows come ten a page, search narrows them, and each meaningful column sorts', async ({
  page,
}) => {
  await open(page);
  await kpi(page).click();
  const panel = drawer(page);
  await panel.getByRole('button', { name: 'Next' }).click();
  await expect(panel.getByText('11–20 of 64')).toBeVisible();
  await panel.getByRole('button', { name: 'Previous' }).click();
  const downtime = panel.getByRole('columnheader', { name: 'Downtime' });
  await downtime.getByRole('button').click();
  await expect(downtime).toHaveAttribute('aria-sort', 'descending');
  const hours = async () =>
    (await rows(page).locator('td:nth-child(3)').allInnerTexts()).map((x) => parseFloat(x));
  const sorted = await hours();
  expect(sorted).toEqual([...sorted].sort((a, b) => b - a));
  await downtime.getByRole('button').click();
  await expect(downtime).toHaveAttribute('aria-sort', 'ascending');
  const first = await rows(page).first().locator('td').first().innerText();
  await panel.getByRole('searchbox').fill(first);
  await expect(rows(page)).toHaveCount(1);
  await expect(panel.getByText('1–1 of 1')).toBeVisible();
  await panel.getByRole('searchbox').fill('no such ticket');
  await expect(panel.getByText('No rows match your search.')).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
});

test('a Pareto bar and a bullet bar open their own rows, and another figure swaps the panel in one Back', async ({
  page,
}) => {
  await open(page);
  await kpi(page).click();
  await expect(drawer(page)).toHaveAttribute('aria-label', 'PM hours');
  await page.getByRole('button', { name: 'Show the rows behind Process machines' }).click();
  await expect(drawer(page)).toHaveAttribute('aria-label', 'Process machines');
  await expect(drawer(page).getByText('17 machines counted')).toBeVisible();
  await expect(rows(page)).toHaveCount(10);
  await page
    .getByRole('button', { name: 'Show the rows behind Machines with no breakdown' })
    .click();
  await expect(drawer(page).getByText('53 machines counted')).toBeVisible();
  await page.goBack();
  await closed(page);
});

test('a machine chip in the rows opens that machine on top, and Back returns to the rows', async ({
  page,
}) => {
  await open(page, '&drawer=figure:dashboard.conventional-machines');
  const first = rows(page).first().getByRole('button').first();
  const code = await first.innerText();
  await first.click();
  await expect(page).toHaveURL(new RegExp(`[?&]drawer=machine:${code}$`));
  await page.goBack();
  await expect(drawer(page)).toHaveAttribute('aria-label', 'Conventional machines');
  await expect(page).toHaveURL(/[?&]drawer=figure:dashboard\.conventional-machines$/);
});

for (const state of ['loading', 'error', 'empty']) {
  test(`${state}: the drawer says so in its own words`, async ({ page }) => {
    await open(page, `&state=${state}&drawer=figure:${PM}`);
    const body = drawer(page);
    if (state === 'loading') await expect(body.getByRole('status')).toHaveText('Loading…');
    if (state === 'error') {
      await expect(body.getByRole('alert')).toBeVisible();
      await expect(body.getByRole('button', { name: 'Try again' })).toBeVisible();
    }
    if (state === 'empty')
      await expect(body.getByText('Nothing is counted behind this figure.')).toBeVisible();
  });
}

test('a figure the plant does not have says nothing is counted, instead of a blank drawer', async ({
  page,
}) => {
  await open(page, '&drawer=figure:nope.nothing');
  await expect(drawer(page).getByText('Nothing is counted behind this figure.')).toBeVisible();
});

test('on a phone the panel covers the page and nothing scrolls sideways', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await kpi(page).click();
  await expect(rows(page)).toHaveCount(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

for (const theme of ['light', 'dark']) {
  test(`axe finds nothing in ${theme}, with the page and with each kind of rows open`, async ({
    page,
  }) => {
    for (const figure of [null, PM, 'dashboard.conventional-machines', 'cell-change-log']) {
      await open(page, `&theme=${theme}${figure ? `&drawer=figure:${figure}` : ''}`);
      if (figure) await expect(rows(page).first()).toBeVisible();
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(violations.map((v) => `${figure} ${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual(
        [],
      );
    }
  });
}
