import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const drawer = (page: Page) => page.locator('aside.v2-drawer');

async function open(page: Page, width: number, theme = 'light') {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-data-checklist&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Data Checklist' })).toBeVisible();
  await expect(page.locator('.v2-lede').getByText('7 of 12 data checks pass')).toBeVisible();
}

for (const width of [1440, 390]) {
  test(`${width} px: a record opens its machine, Back closes it, a fix is sent and taken back, nothing scrolls sideways`, async ({
    page,
  }) => {
    await open(page, width);
    const table = page.getByRole('region', { name: 'Records to fix' });
    await expect(table.getByText('1–10 of 22')).toBeVisible();
    await table.getByRole('button', { name: 'Breakdown log' }).click();
    await expect(table.getByText('1–10 of 15')).toBeVisible();
    await table
      .getByRole('button', { name: /^Open [a-z]\d-/ })
      .first()
      .click();
    await expect(page).toHaveURL(/drawer=machine:/);
    await expect(drawer(page)).not.toHaveAttribute('inert', '');
    await page.goBack();
    await expect(drawer(page)).toHaveAttribute('inert', '');
    const fix = page.getByRole('button', { name: 'Code them now' });
    await expect(fix).toHaveAttribute('aria-pressed', 'false');
    await fix.click();
    const sent = page.getByRole('button', { name: 'Sent to Meera K' }).first();
    await expect(sent).toHaveAttribute('aria-pressed', 'true');
    await sent.click();
    await expect(page.getByRole('button', { name: 'Code them now' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });
}

for (const theme of ['light', 'dark']) {
  test(`axe finds nothing in ${theme}, with the Whys and a drawer open`, async ({ page }) => {
    await open(page, 1440, theme);
    for (const why of await page.getByRole('button', { name: /^Why/ }).all()) await why.click();
    await page
      .getByRole('button', { name: /^Open [a-z]\d-/ })
      .first()
      .click();
    await expect(drawer(page)).not.toHaveAttribute('inert', '');
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
    await page.goto(`/gallery?view=v2-data-checklist&state=${state}`);
    await expect(page.locator(marker)).toBeVisible();
  }
});
