import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const drawer = (page: Page) => page.locator('aside.v2-drawer');

/** The four Machines screens of batch 2 still in the gallery (the cell change log is live): the gallery view, its heading and a line the answer key makes true. */
const SCREENS = [
  { view: 'v2-machines-register', heading: 'Machines register', lede: 'CNC Machines: 126' },
  { view: 'v2-oem', heading: 'OEM', lede: '24 machines under 300 days old' },
  { view: 'v2-age', heading: 'Age', lede: 'Machines aged 20+ yrs lose the most' },
  { view: 'v2-footprint', heading: 'Footprint', lede: 'The fleet needs a floor of 2,970 m²' },
] as const;

async function open(
  page: Page,
  view: string,
  heading: string,
  options: { width?: number; query?: string } = {},
) {
  const { width = 1440, query = '' } = options;
  await page.setViewportSize({ width, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=${view}${query}`);
  await page.mouse.move(700, 450);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
}

for (const { view, heading, lede } of SCREENS) {
  for (const width of [1440, 390]) {
    test(`${view} at ${width} px: it answers first, a machine opens in the drawer, Back closes it, nothing scrolls sideways`, async ({
      page,
    }) => {
      await open(page, view, heading, { width });
      await expect(page.locator('.v2-lede')).toContainText(lede);
      if (view === 'v2-age') {
        // The bands name no machine: sorting a column re-orders the rows instead.
        await page.getByRole('button', { name: 'Average per machine' }).click();
        await expect(page.getByRole('row').nth(1)).toContainText('20+ yrs');
      } else {
        await page
          .getByRole('button', { name: /^[A-Z]{1,4}-\d+$/ })
          .first()
          .click();
        await expect(page).toHaveURL(/[?&]drawer=machine:/);
        await expect(drawer(page)).not.toHaveAttribute('inert', '');
        await page.goBack();
        await expect(drawer(page)).toHaveAttribute('inert', '');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
    });
  }

  for (const theme of ['light', 'dark']) {
    test(`${view}: axe finds nothing in ${theme}, with a drawer open`, async ({ page }) => {
      await open(page, view, heading, { query: `&theme=${theme}` });
      if (view !== 'v2-age')
        await page
          .getByRole('button', { name: /^[A-Z]{1,4}-\d+$/ })
          .first()
          .click();
      const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual(
        [],
      );
    });
  }

  test(`${view}: the loading, empty and error states are designed`, async ({ page }) => {
    for (const [state, marker] of [
      ['loading', '[data-state="loading"]'],
      ['empty', '[data-state="empty"]'],
      ['error', '[data-state="error"]'],
    ] as const) {
      await page.goto(`/gallery?view=${view}&state=${state}`);
      await expect(page.locator(marker)).toBeVisible();
    }
  });
}

test('the register opens on CNC, switches register in the URL and says what a machine list holds', async ({
  page,
}) => {
  await open(page, 'v2-machines-register', 'Machines register');
  await expect(page.getByRole('group', { name: 'Registers' }).getByRole('button')).toHaveCount(6);
  await page.getByRole('button', { name: 'DG', exact: true }).click();
  await expect(page).toHaveURL(/[?&]register=dg/);
  await expect(page.locator('.v2-lede')).toContainText('DG Sets: 3');
  await page.goto('/gallery?view=v2-machines-register&register=conv');
  await expect(page.locator('.v2-lede')).toContainText('Conventional Machines: 16');
  const list = page.getByRole('region', { name: 'Machines on this register' });
  await expect(list.getByText(/^1–10 of 16$/)).toBeVisible();
});

test('no rupee on the OEM page for a login that is not a head, plant head or admin', async ({
  page,
}) => {
  await open(page, 'v2-oem', 'OEM', { query: '&role=op' });
  await expect(page.locator('main')).not.toContainText('₹');
  await open(page, 'v2-oem', 'OEM');
  await expect(page.locator('main')).toContainText('₹ 59,994 to claim');
});
