import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PAGE = '/gallery?view=v2-dashboard';
const AXIS = 'Stop axis motor and encoder failures';
const drawer = (page: Page) => page.locator('aside.v2-drawer');
const decision = (page: Page) => page.locator('article.v2-decision').first();
const chip = (scope: ReturnType<Page['locator']>, name: string) =>
  scope.getByRole('button', { name, exact: true });

/** The page on a blank history entry, so "Back" past the first step is visible as leaving the gallery. */
async function open(page: Page, url = PAGE) {
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('November is')).toBeVisible();
}
const closed = async (page: Page) => {
  await expect(drawer(page)).toHaveAttribute('inert', '');
  await expect(page).not.toHaveURL(/drawer=/);
};
const params = (page: Page) => new URL(page.url()).searchParams;

test.use({ viewport: { width: 1440, height: 900 } });

test('a machine chip opens that machine; Back closes it and the page is as before; Forward reopens it', async ({
  page,
}) => {
  await open(page);
  await chip(decision(page), 'VC-67').click();
  await expect(drawer(page)).toHaveAttribute('aria-label', 'Vertical machining centre 67');
  await expect(page).toHaveURL(/[?&]drawer=machine:VC-67$/);
  expect(params(page).get('view')).toBe('v2-dashboard');
  await expect(drawer(page).getByText('Breakdown hours', { exact: true })).toBeVisible();
  await page.goBack();
  await closed(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await page.goForward();
  await expect(drawer(page)).toHaveAttribute('aria-label', 'Vertical machining centre 67');
});

for (const how of ['the ✕', 'Esc', 'the same chip']) {
  test(`${how} closes the drawer in one history step, with no dead Back entry`, async ({
    page,
  }) => {
    await open(page);
    await chip(decision(page), 'VC-67').click();
    await expect(drawer(page)).toHaveAttribute('aria-label', 'Vertical machining centre 67');
    if (how === 'the ✕') await drawer(page).getByRole('button', { name: 'Close' }).click();
    else if (how === 'Esc') await page.keyboard.press('Escape');
    else await chip(decision(page), 'VC-67').click();
    await closed(page);
    await page.goBack();
    expect(page.url()).toBe('about:blank');
  });
}

test('a pasted link opens the drawer, and ✕ removes it without leaving the page or adding a step', async ({
  page,
}) => {
  await open(page, `${PAGE}&drawer=machine:TC-4`);
  await expect(drawer(page)).toHaveAttribute('aria-label', 'Turning centre 4');
  await drawer(page).getByRole('button', { name: 'Close' }).click();
  await closed(page);
  expect(params(page).get('view')).toBe('v2-dashboard');
  await page.goBack();
  expect(page.url()).toBe('about:blank');
});

test('another chip while one is open swaps the content, and one Back closes however many were visited', async ({
  page,
}) => {
  await open(page);
  await chip(decision(page), 'VC-67').click();
  await chip(drawer(page), 'Cell 5').click();
  await expect(drawer(page)).toHaveAttribute('aria-label', 'Cell 5');
  await expect(drawer(page).getByText('Machines that cost the most hours')).toBeVisible();
  await chip(drawer(page), 'VC-67').click();
  await expect(drawer(page)).toHaveAttribute('aria-label', 'Vertical machining centre 67');
  await page.goBack();
  await closed(page);
});

test('a chip in a clickable row opens its own thing, not the row’s item', async ({ page }) => {
  await open(page);
  await chip(decision(page), 'VC-94').click();
  await expect(drawer(page)).toHaveAttribute('aria-label', 'Vertical machining centre 94');
  await chip(decision(page), 'Arjun V').click();
  await expect(drawer(page)).toHaveAttribute('aria-label', 'Arjun V');
  await expect(drawer(page).getByText('Senior technician')).toBeVisible();
  const table = page.getByRole('region', { name: 'Machines' });
  await chip(table.locator('tbody tr').first(), 'Cell 4').click();
  await expect(drawer(page)).toHaveAttribute('aria-label', 'Cell 4');
  await expect(page.locator('tr[data-selected="true"]')).toHaveCount(0);
});

test('a row still opens its machine, a decision opens with its Decide button, and each has its full page', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: AXIS }).click();
  await expect(page).toHaveURL(/drawer=decision:axis$/);
  await expect(drawer(page).getByRole('button', { name: 'Assign a root-cause fix' })).toBeVisible();
  await expect(drawer(page).getByRole('link', { name: 'Open full page' })).toHaveAttribute(
    'href',
    '/analytics/today/action-center?drawer=decision:axis',
  );
  await page.getByRole('button', { name: 'Open TC-56' }).click();
  await expect(page).toHaveURL(/drawer=machine:TC-56$/);
  const full = drawer(page).getByRole('link', { name: 'Open full page' });
  await expect(full).toHaveAttribute('href', '/analytics/machines/TC-56');
  await expect(full).toBeInViewport();
});

test('a thing that is not there says so inside the drawer, and an unknown kind opens nothing', async ({
  page,
}) => {
  await open(page, `${PAGE}&drawer=machine:NOPE-1`);
  await expect(drawer(page).getByText('We could not find this one.')).toBeVisible();
  await drawer(page).getByRole('button', { name: 'Close' }).click();
  await closed(page);
  await open(page, `${PAGE}&drawer=widget:1`);
  await expect(drawer(page)).toHaveAttribute('inert', '');
});

test('on a phone the drawer covers the page and its full-page link stays in reach', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page);
  await chip(decision(page), 'VC-67').click();
  await expect(drawer(page)).toHaveAttribute('aria-label', 'Vertical machining centre 67');
  await expect(drawer(page).getByRole('link', { name: 'Open full page' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

for (const theme of ['light', 'dark']) {
  test(`axe finds nothing in ${theme} with a machine, a cell and a person open`, async ({
    page,
  }) => {
    for (const drawerParam of ['machine:VC-67', 'cell:Cell%205', 'person:arjun-v']) {
      await open(page, `${PAGE}&theme=${theme}&drawer=${drawerParam}`);
      await expect(drawer(page)).not.toHaveAttribute('inert', '');
      await expect(drawer(page).getByRole('heading', { level: 2 })).toBeVisible();
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        violations.map((v) => `${drawerParam} ${v.id}: ${v.nodes.map((n) => n.target)}`),
      ).toEqual([]);
    }
  });
}
