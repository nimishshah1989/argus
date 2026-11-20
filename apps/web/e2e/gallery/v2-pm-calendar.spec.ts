import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
test.use({ trace: 'retain-on-failure' });

const drawer = (page: Page) => page.locator('aside.v2-drawer');
/** The library's own cell for a day; its class names are hashed, `[data-date]` is the stable hook. */
const cell = (page: Page, day: string) => page.locator(`[data-date="${day}"]`).first();
const jobs = (page: Page) => page.getByRole('region', { name: 'Jobs this month', exact: true });

async function open(page: Page, extra = '', theme = 'light') {
  await page.setViewportSize({ width: 1440, height: 1500 });
  await page.goto('about:blank');
  await page.goto(`/gallery?view=v2-pm-calendar&theme=${theme}${extra}`);
  await expect(page.getByRole('heading', { level: 1, name: 'PM calendar' })).toBeVisible();
  await expect(
    page.getByText(/PM compliance is 25\.0 % and schedule compliance is 27\.3 %\./),
  ).toBeVisible();
  await expect(cell(page, '2026-11-13').getByText('VC-13', { exact: true })).toBeVisible();
}

/** Holds the pointer over a day's cell until the page itself says the pointer is on it, then drops. */
async function drag(page: Page, code: string, fromDay: string, day: string) {
  await page.waitForLoadState('networkidle');
  const chip = cell(page, fromDay).getByText(code, { exact: true });
  const from = await chip.boundingBox();
  if (!from) throw new Error(`no box for ${code}`);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 20, { steps: 5 });
  // A first nudge inside the chip starts the library's drag; jumping straight to the target can outrun it.
  await page.waitForTimeout(200);
  for (let pass = 0; pass < 8; pass += 1) {
    const box = await cell(page, day).boundingBox();
    if (box) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y, { steps: 10 });
      const under = await page.evaluate(
        ([px, py]) =>
          document
            .elementsFromPoint(px!, py!)
            .find((el) => el.hasAttribute('data-date'))
            ?.getAttribute('data-date') ?? null,
        [x, y],
      );
      if (under === day) break;
    }
    await page.waitForTimeout(150);
  }
  await page.mouse.up();
}

test('PM calendar: the answer and four figures are up, a chip on the grid opens the machine, Back closes it', async ({
  page,
}) => {
  await open(page);
  for (const label of [
    'PM compliance',
    'Schedule compliance',
    'Crowded PM jobs',
    'PM jobs in view',
  ])
    await expect(page.getByRole('region', { name: label, exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'PM compliance', exact: true })
      .getByText('2 of 8 PM jobs on time'),
  ).toBeVisible();
  await expect(page.getByText('Late 2', { exact: true })).toBeVisible();
  await cell(page, '2026-11-13').getByText('VC-13', { exact: true }).click();
  await expect(page).toHaveURL(/[?&]drawer=machine:VC-13$/);
  await expect(drawer(page)).not.toHaveAttribute('inert', '');
  await page.goBack();
  await expect(drawer(page)).toHaveAttribute('inert', '');
});

test('PM calendar: a drag moves a job to a free day, and a full day refuses it and the chip snaps back', async ({
  page,
}) => {
  await open(page);
  await drag(page, 'VC-13', '2026-11-13', '2026-11-18');
  await expect(
    page.getByRole('status').getByText('VC-13 moved to 18-Nov-2026.', { exact: true }),
  ).toBeVisible();
  await expect(cell(page, '2026-11-18').getByText('VC-13', { exact: true })).toBeVisible();
  await drag(page, 'VC-13', '2026-11-18', '2026-11-14');
  await expect(page.getByRole('alert').getByText('That day already has a PM job')).toBeVisible();
  await expect(cell(page, '2026-11-18').getByText('VC-13', { exact: true })).toBeVisible();
});

test('PM calendar: Move to date works from the keyboard alone, and focus comes back to the job', async ({
  page,
}) => {
  await open(page);
  await jobs(page).getByRole('searchbox').fill('VC-21');
  const button = jobs(page).getByRole('button', { name: 'Move to date VC-21' });
  await button.focus();
  await page.keyboard.press('Enter');
  const field = page.getByLabel('New date');
  await expect(field).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(field).toHaveCount(0);
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
  await field.fill('2026-11-15');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText('PM jobs are scheduled Monday to Saturday');
  await expect(field).toBeVisible();
  await field.fill('2026-11-19');
  await page.keyboard.press('Enter');
  await expect(field).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: 'VC-21 moved to 19-Nov-2026.' }),
  ).toBeVisible();
  await expect(button).toBeFocused();
});

test('PM calendar: a connection that is down says the move was not saved and offers it again', async ({
  page,
}) => {
  await open(page, '&offline=1');
  await jobs(page).getByRole('searchbox').fill('VC-21');
  await jobs(page).getByRole('button', { name: 'Move to date VC-21' }).click();
  await page.getByLabel('New date').fill('2026-11-19');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Not saved: the connection is down');
  await expect(page.getByLabel('New date')).toBeVisible();
});

test('PM calendar: a login that may only read sees the calendar and the days, and no Move button', async ({
  page,
}) => {
  await open(page, '&role=plant-head');
  await expect(jobs(page).getByRole('button', { name: /^Move to date/ })).toHaveCount(0);
  await expect(page.getByText(/Drag a job to move it/)).toHaveCount(0);
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: 'Next Month' }).click();
  await expect(cell(page, '2027-02-15')).toBeVisible();
  const spread = page.getByRole('region', { name: 'Spread the load', exact: true });
  await expect(spread.getByText(/Nearest free day \d{2}-[A-Z][a-z]{2}-2027/).first()).toBeVisible();
  await expect(spread.getByRole('button', { name: /^Move to \d/ })).toHaveCount(0);
});

test('PM calendar: crowded days list their nearest free day and one press moves the job there', async ({
  page,
}) => {
  await open(page);
  for (let i = 0; i < 3; i += 1) await page.getByRole('button', { name: 'Next Month' }).click();
  await expect(cell(page, '2027-02-15')).toBeVisible();
  const spread = page.getByRole('region', { name: 'Spread the load', exact: true });
  await expect(spread.locator('tbody tr')).not.toHaveCount(0);
  await spread
    .getByRole('button', { name: /^Move to \d/ })
    .first()
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: / moved to \d{2}-[A-Z][a-z]{2}-2027\./ }),
  ).toBeVisible();
});

test('PM calendar: on a phone the page does not scroll sideways, so the window holds the whole month', async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 727 });
  await page.goto('about:blank');
  await page.goto('/gallery?view=v2-pm-calendar&theme=light');
  await expect(page.getByRole('heading', { level: 1, name: 'PM calendar' })).toBeVisible();
  // A table wider than the screen scrolls inside its card; a part of it that is only for a screen reader must not widen the page.
  const widths = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(widths[0]).toBeLessThanOrEqual(widths[1]!);
});

for (const theme of ['light', 'dark']) {
  test(`PM calendar: axe finds nothing in ${theme}, with the machine drawer open`, async ({
    page,
  }) => {
    await open(page, '', theme);
    await cell(page, '2026-11-13').getByText('VC-13', { exact: true }).click();
    await expect(drawer(page)).not.toHaveAttribute('inert', '');
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);
  });
}
