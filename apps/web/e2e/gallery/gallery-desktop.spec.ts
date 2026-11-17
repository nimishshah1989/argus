import { expect, test, type Page } from '@playwright/test';
import { DIALOG, expectAxeClean, frame } from './axe.js';

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/gallery?view=desktop${query}`);
  await page.getByTestId('gallery-root').waitFor();
  await expect(page.getByTestId('gallery-desktop-queue').getByRole('table')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const ticketsInOrder = (page: Page) =>
  page.getByTestId('gallery-desktop-queue').locator('tbody tr th');

async function openAddSheet(page: Page) {
  await page.getByTestId('gallery-crud').getByRole('button', { name: 'Add', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('at 1440 px', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a sortable header reorders the rows and says which way', async ({ page }) => {
    await open(page);
    const queue = page.getByTestId('gallery-desktop-queue');
    const problem = queue.getByRole('columnheader', { name: 'Problem' });
    await expect(ticketsInOrder(page)).toHaveText(['BD-0101', 'BD-0102', 'BD-0103']);
    await expect(problem).toHaveAttribute('aria-sort', 'none');
    await problem.getByRole('button').click();
    await expect(problem).toHaveAttribute('aria-sort', 'ascending');
    await expect(ticketsInOrder(page)).toHaveText(['BD-0102', 'BD-0103', 'BD-0101']);
    await problem.getByRole('button').click();
    await expect(problem).toHaveAttribute('aria-sort', 'descending');
    await expect(ticketsInOrder(page)).toHaveText(['BD-0101', 'BD-0103', 'BD-0102']);
    await queue.getByRole('columnheader', { name: 'Ticket' }).getByRole('button').click();
    await expect(problem).toHaveAttribute('aria-sort', 'none');
    await expect(queue.getByRole('columnheader', { name: 'Ticket' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await expect(ticketsInOrder(page)).toHaveText(['BD-0101', 'BD-0102', 'BD-0103']);
  });

  test('load more stays under the table', async ({ page }) => {
    await open(page);
    const queue = page.getByTestId('gallery-desktop-queue');
    await queue.getByRole('button', { name: 'Load more' }).click();
    await expect(ticketsInOrder(page)).toHaveCount(5);
  });

  test('the edit sheet is a right side panel the full height of the screen', async ({ page }) => {
    await open(page);
    const dialog = await openAddSheet(page);
    const box = (await dialog.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x + box.width).toBeCloseTo(viewport.width, 0);
    expect(box.y).toBeCloseTo(0, 0);
    expect(box.height).toBeCloseTo(viewport.height, 0);
    expect(box.width).toBeGreaterThanOrEqual(340);
    expect(box.width).toBeLessThanOrEqual(400);
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('the left menu marks the current item', async ({ page }) => {
    await open(page);
    const nav = page.getByRole('navigation', { name: 'Settings menu' });
    await expect(nav.getByRole('link', { name: 'Machines' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.getByRole('link', { name: 'People' })).not.toHaveAttribute('aria-current');
    await expect(nav.getByRole('link', { name: /Audit log/ })).toContainText('3');
    expect((await nav.boundingBox())!.width).toBeCloseTo(232, 0);
  });
});

test('at 360 px the sheet is still at the bottom and the queue stays cards', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/gallery?view=desktop');
  await page.getByTestId('gallery-root').waitFor();
  await expect(page.getByTestId('gallery-desktop-queue').getByRole('table')).toHaveCount(0);
  await expect(page.getByTestId('gallery-desktop-queue').locator('li')).toHaveCount(3);
  const dialog = await openAddSheet(page);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeCloseTo(0, 0);
  expect(box.width).toBeCloseTo(360, 0);
  expect(box.y + box.height).toBeCloseTo(800, 0);
  expect(box.height).toBeLessThan(800 * 0.86);
});

for (const theme of ['light', 'dark']) {
  const suffix = theme === 'dark' ? '-dark' : '';
  test.describe(`screenshots, ${theme}`, () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test(`desktop ${theme}: queue, detail and crud match their baselines, axe clean`, async ({
      page,
    }) => {
      await open(page, `&theme=${theme}`);
      for (const [id, name] of [
        ['gallery-desktop-queue', 'desktop-queue'],
        ['gallery-desktop-detail', 'desktop-detail'],
        ['gallery-crud', 'desktop-crud'],
      ] as const)
        await expect(page.getByTestId(id)).toHaveScreenshot(`${name}${suffix}.png`);
      await expectAxeClean(page, [
        frame('gallery-desktop-queue'),
        frame('gallery-desktop-detail'),
        frame('gallery-crud'),
      ]);
    });

    test(`desktop ${theme}: the open side panel matches its baseline, axe clean`, async ({
      page,
    }) => {
      await open(page, `&theme=${theme}`);
      await openAddSheet(page);
      await expect(page).toHaveScreenshot(`desktop-sheet-open${suffix}.png`);
      await expectAxeClean(page, [DIALOG]);
    });
  });
}
