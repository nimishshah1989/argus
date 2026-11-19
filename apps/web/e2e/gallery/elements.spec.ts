import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const PARTS = [
  'kpi',
  'chip',
  'heat',
  'ranked',
  'timeline',
  'insight',
  'states',
  'table',
  'period',
  'nav',
  'trail',
];

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`/gallery?${query}`);
  await page.getByTestId('gallery-elements').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

/** What break-ui looks for: the page scrolls sideways, or a control is under 44 px. */
async function expectNoBreakage(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    view: document.documentElement.clientWidth,
  }));
  expect(widths.page, 'the page scrolls sideways').toBeLessThanOrEqual(widths.view);
  const small = await page.getByTestId('gallery-elements').evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>('button, a, input, select')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.height < 43.5 || box.width < 43.5)
      .map(({ el }) => `${el.tagName} ${el.textContent?.slice(0, 20) ?? ''}`),
  );
  expect(small, 'tap targets under 44 px').toEqual([]);
}

for (const size of [
  { name: '360', width: 360, height: 800 },
  { name: '1440', width: 1440, height: 900 },
]) {
  for (const theme of ['light', 'dark']) {
    for (const worst of [false, true]) {
      test(`elements at ${size.name} px, ${theme}${worst ? ', worst case' : ''}: no overflow, 44 px taps, axe clean`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await open(page, `lang=en&theme=${theme}`);
        for (const part of PARTS) await expect(page.getByTestId(`element-${part}`)).toBeAttached();
        if (worst) await page.getByRole('button', { name: 'Worst case' }).click();
        await expectNoBreakage(page);
        const axe = await new AxeBuilder({ page })
          .withTags(AXE_TAGS)
          .include('[data-testid="gallery-elements"]')
          .analyze();
        expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 80)}`)).toEqual([]);
      });
    }
  }
}

test('a list held in the browser pages, sorts and filters', async ({ page }) => {
  await open(page, 'lang=en');
  const table = page.getByTestId('element-table');
  await expect(table.locator('tbody tr')).toHaveCount(25);
  await expect(table).toContainText('1 to 25 of 120');
  await table.getByRole('button', { name: 'Next' }).click();
  await expect(table).toContainText('26 to 50 of 120');
  await table.getByRole('button', { name: /Hours/ }).click();
  await expect(table.getByRole('columnheader', { name: /Hours/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await expect(table).toContainText('1 to 25 of 120');
  await table.getByRole('searchbox').fill('zzz');
  await expect(table).toContainText('No rows match');
});

test('a long list pages on the server: 50 rows first, then the next 50, filtered by the server', async ({
  page,
}) => {
  await open(page, 'lang=en');
  const table = page.getByTestId('element-table-server');
  await expect(table.locator('tbody tr')).toHaveCount(50);
  await expect(table).toContainText('1 to 50 of 1,343');
  await table.getByRole('button', { name: 'Next' }).click();
  await expect(table).toContainText('51 to 100 of 1,343');
  await table.getByRole('searchbox').fill('Machine 13');
  await expect(table).toContainText('1 to 50 of 55');
});

test('the heat grid pops in with motion, and not under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page, 'lang=en');
  const cell = page.getByTestId('element-heat').locator('td').nth(1);
  await expect(cell).toHaveCSS('animation-name', 'el-pop');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(cell).toHaveCSS('animation-name', 'none');
});

test('the period picker presses the chosen period; own dates clear it', async ({ page }) => {
  await open(page, 'lang=en');
  const picker = page.getByTestId('element-period');
  await expect(picker.getByRole('button', { name: '7 days' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await picker.getByRole('button', { name: 'Year' }).click();
  await expect(picker.getByRole('button', { name: '7 days' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await picker.getByLabel('From').fill('2026-03-10');
  await expect(picker.locator('[aria-pressed="true"]')).toHaveCount(0);
});
