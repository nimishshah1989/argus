import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const drawer = (page: Page) => page.locator('aside.v2-drawer');

async function open(page: Page, theme = 'light', width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-compare&theme=${theme}`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Compare machines', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('more hours')).toBeVisible();
}

test('Compare: the verdict is up, the two boxes line up row for row, a machine chip opens the drawer, Back closes it', async ({
  page,
}) => {
  await open(page);
  const boxes = page.locator('section.v2-compare');
  await expect(boxes).toHaveCount(2);
  const tops = async (n: number) =>
    boxes
      .nth(n)
      .locator('.v2-compare-row')
      .evaluateAll((rows) => rows.map((r) => Math.round(r.getBoundingClientRect().top)));
  expect(await tops(0)).toEqual(await tops(1));
  await boxes.nth(1).getByRole('button', { name: 'VC-18', exact: true }).click();
  await expect(drawer(page)).toHaveAttribute('aria-label', 'Vertical machining centre 18');
  await expect(page).toHaveURL(/[?&]drawer=machine:VC-18$/);
  await page.goBack();
  await expect(drawer(page)).toHaveAttribute('inert', '');
});

test('Compare: picking another machine changes the pair, and the fix is added in one press', async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole('group', { name: 'Second machine' })
    .getByRole('button', { name: 'VC-94' })
    .click();
  await expect(page).toHaveURL(/b=VC-94/);
  await expect(page.locator('section.v2-compare').nth(1)).toHaveAttribute('aria-label', 'VC-94');
  await page.getByRole('button', { name: 'Add the fix to Team Focus' }).click();
  await expect(page.getByText('Added to Team Focus')).toBeVisible();
});

for (const theme of ['light', 'dark']) {
  test(`Compare: axe finds nothing in ${theme}, with the Why and the drawer open`, async ({
    page,
  }) => {
    await open(page, theme);
    await page.getByRole('button', { name: /^Why/ }).click();
    await page
      .locator('section.v2-compare')
      .first()
      .getByRole('button', { name: 'VC-67', exact: true })
      .click();
    await expect(drawer(page)).toHaveAttribute('aria-label', 'Vertical machining centre 67');
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
