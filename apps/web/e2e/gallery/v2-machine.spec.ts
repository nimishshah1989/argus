import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const drawer = (page: Page) => page.locator('aside.v2-drawer');

async function open(page: Page, width = 1440, theme = 'light', id = 'VC-67') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-machine&id=${id}&theme=${theme}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Vertical machining centre 67' }),
  ).toBeVisible();
  await expect(page.getByText('This machine is down')).toBeVisible();
}

for (const width of [1440, 390]) {
  test(`${width} px: a person chip opens the drawer, Back closes it, a breakdown row opens its story, nothing scrolls sideways`, async ({
    page,
  }) => {
    await open(page, width);
    const table = page.getByRole('region', { name: 'Breakdown history' });
    await expect(table.getByText(/^1–10 of \d+$/)).toBeVisible();
    await page.getByRole('button', { name: 'Neel S', exact: true }).first().click();
    await expect(drawer(page)).toHaveAttribute('aria-label', 'Neel S');
    await expect(page).toHaveURL(/[?&]drawer=person:neel-s$/);
    await page.goBack();
    await expect(drawer(page)).toHaveAttribute('inert', '');
    await table.getByRole('searchbox').fill('spindle');
    await table.getByRole('row').nth(1).click();
    await expect(page.getByRole('region', { name: /Spindle alarm/ }).last()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });
}

test('a machine the plant does not have says so, and a code in the address is not a crash', async ({
  page,
}) => {
  await page.goto('/gallery?view=v2-machine&id=ZZ-0');
  await expect(page.getByText('We could not find this machine.')).toBeVisible();
});

for (const theme of ['light', 'dark']) {
  test(`axe finds nothing in ${theme}, with the Why and a breakdown open`, async ({ page }) => {
    await open(page, 1440, theme);
    await page.getByRole('button', { name: /^Why/ }).first().click();
    await page.getByRole('region', { name: 'Breakdown history' }).getByRole('row').nth(1).click();
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
