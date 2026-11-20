import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
// A trace of a failing run goes into the CI artifact (test-results/gallery).
test.use({ trace: 'retain-on-failure' });

const drawer = (page: Page) => page.locator('aside.v2-drawer');

async function open(page: Page, theme = 'light') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-team-focus&theme=${theme}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Team Focus' })).toBeVisible();
  await expect(page.getByText('19 open actions put')).toBeVisible();
}

test('Team Focus: the headline is up, a person chip opens the drawer, Back closes it', async ({
  page,
}) => {
  const trouble: string[] = [];
  page.on('pageerror', (e) => trouble.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => trouble.push(`requestfailed: ${r.url()}`));
  page.on('console', (m) => m.type() === 'error' && trouble.push(`console: ${m.text()}`));
  try {
    await test.step('open', async () => {
      await open(page);
      await expect(page.getByText('4 have no owner')).toBeVisible();
    });
    const chip = page
      .getByRole('region', { name: 'Who is carrying what' })
      .getByRole('button', { name: 'Arjun V', exact: true });
    await test.step('click chip', async () => {
      await chip.scrollIntoViewIfNeeded({ timeout: 10_000 });
      await chip.click({ timeout: 10_000 });
      await expect(drawer(page)).toHaveAttribute('aria-label', 'Arjun V');
    });
    await test.step('url', async () => {
      await expect(page).toHaveURL(/[?&]drawer=person:arjun-v$/);
    });
    await test.step('back', async () => {
      await page.goBack({ timeout: 10_000 });
      await expect(drawer(page)).toHaveAttribute('inert', '');
      await expect(page.getByRole('heading', { level: 1, name: 'Team Focus' })).toBeVisible();
    });
  } finally {
    if (trouble.length) console.log(trouble.join('\n'));
  }
});

test('Team Focus: an action is assigned in one press, and the list counts it', async ({ page }) => {
  await open(page);
  const assign = page.getByRole('button', { name: 'Assign to Meera K' }).first();
  await assign.click();
  await expect(page.getByRole('button', { name: 'Assigned to Meera K' }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('1 of 4 assigned')).toBeVisible();
});

for (const theme of ['light', 'dark']) {
  test(`Team Focus: axe finds nothing in ${theme}, with the Whys and the drawer open`, async ({
    page,
  }) => {
    await open(page, theme);
    for (const why of await page.getByRole('button', { name: /^Why/ }).all()) await why.click();
    await page
      .getByRole('region', { name: 'Who is carrying what' })
      .getByRole('button', { name: 'Arjun V', exact: true })
      .click();
    await expect(drawer(page)).toHaveAttribute('aria-label', 'Arjun V');
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
