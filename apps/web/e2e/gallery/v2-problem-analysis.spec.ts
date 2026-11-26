import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openShowDetail } from '../show-detail.js';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
test.use({ trace: 'retain-on-failure' });

const drawer = (page: Page) => page.locator('aside.v2-drawer');

async function open(page: Page, theme = 'light') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-problem-analysis&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Problem Analysis' })).toBeVisible();
  await expect(page.getByText('Axis motor costs the most: 15.85% of all hours.')).toBeVisible();
}

test('Problem Analysis: eight figures, two charts and the tables are up; a machine chip opens the drawer', async ({
  page,
}) => {
  await open(page);
  // The what-if figures sit behind their own fold (ADR 0049); the charts are kit pieces (ADR 0043).
  await openShowDetail(page, page.getByRole('region', { name: 'Breakdowns studied', exact: true }));
  for (const label of ['Breakdowns studied', 'Repeat problems', 'Downtime saved', 'MTBF'])
    await expect(page.getByRole('region', { name: label, exact: true })).toBeVisible();
  await expect(page.locator('ol.v2-ranked')).toBeVisible();
  await expect(page.locator('svg.v2-quad')).toBeVisible();
  const repeats = page.getByRole('region', { name: 'Repeat offenders' });
  await expect(repeats.locator('tbody tr')).toHaveCount(10);
  await repeats.getByRole('button', { name: 'TC-5', exact: true }).first().click();
  await expect(page).toHaveURL(/[?&]drawer=machine:TC-5$/);
  await expect(drawer(page)).not.toHaveAttribute('inert', '');
  await page.goBack();
  await expect(drawer(page)).toHaveAttribute('inert', '');
});

test('Problem Analysis: the groups table sorts by hours and the family chips narrow it', async ({
  page,
}) => {
  await open(page);
  const groups = page.getByRole('region', { name: 'All problem groups' });
  const hours = groups.getByRole('columnheader', { name: /^Hours/ });
  await hours.getByRole('button').click();
  await expect(hours).toHaveAttribute('aria-sort', 'descending');
  await groups.getByRole('button', { name: 'Fluids and chips', exact: true }).click();
  await expect(groups.locator('tbody tr').first()).toContainText('Fluids and chips');
});

test('Problem Analysis: "On this page" lists the parts, jumps to one, marks it and puts it in the address', async ({
  page,
}) => {
  await open(page);
  const rail = page.getByRole('navigation', { name: 'On this page' });
  await expect(rail).toBeVisible();
  const link = rail.getByRole('link', { name: 'Repeat offenders', exact: true });
  await expect(link).toHaveAttribute('href', '#repeat-offenders');
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#repeat-offenders$/);
  await expect(link).toHaveAttribute('aria-current', 'location');
  const heading = page.getByRole('heading', { level: 2, name: 'Repeat offenders' });
  await expect(heading).toBeFocused();
  await expect.poll(async () => (await heading.boundingBox())?.y ?? -1).toBeLessThan(200);
  // A pasted link to the part lands on it.
  await page.goto('/gallery?view=v2-problem-analysis#repeat-offenders');
  await expect.poll(async () => (await heading.boundingBox())?.y ?? -1).toBeLessThan(200);
  // The same part is in the search.
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('Repeat offenders');
  await expect(page.getByRole('option', { name: /Repeat offenders/ })).toBeVisible();
});

test('Problem Analysis: on a phone the parts are a menu at the top of the page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gallery?view=v2-problem-analysis');
  await expect(page.getByRole('navigation', { name: 'On this page' })).toBeHidden();
  const jump = page.getByRole('button', { name: 'On this page' });
  await expect(jump).toHaveAttribute('aria-expanded', 'false');
  await jump.click();
  const list = page.getByRole('navigation', { name: 'On this page' });
  await list.getByRole('link', { name: 'Repeat offenders', exact: true }).click();
  await expect(page).toHaveURL(/#repeat-offenders$/);
  // The menu closes once it has taken the reader there.
  await expect(jump).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('heading', { level: 2, name: 'Repeat offenders' })).toBeFocused();
});

for (const theme of ['light', 'dark']) {
  test(`Problem Analysis: axe finds nothing in ${theme}`, async ({ page }) => {
    await open(page, theme);
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
