import { expect, test, type Locator, type Page } from '@playwright/test';

const VIEWPORTS = [360, 1440];

async function expectTargetSize(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(52);
  expect(box?.height).toBeGreaterThanOrEqual(52);
}

async function expectKeyboardFocus(locator: Locator): Promise<void> {
  await locator.focus();
  await locator.press('Shift+Tab');
  await locator.page().keyboard.press('Tab');
  await expect(locator).toBeFocused();
  const outline = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
  });
  expect(outline.style).not.toBe('none');
  expect(outline.width).toBeGreaterThanOrEqual(2);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
}

async function captureEvidence(page: Page, path: string, capture: boolean): Promise<void> {
  if (!capture) return;
  await page.screenshot({ path, fullPage: true });
}

async function captureFloor(width: number, page: Page, capture: boolean): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/design-preview');
  await expect(page.getByText('Design preview — no actions saved', { exact: true })).toBeVisible();
  await page.getByLabel('Search machines').fill('VC-17');
  await page.getByRole('button', { name: /^VC-17/ }).click();
  await page.getByRole('button', { name: 'Stopped', exact: true }).click();
  await page.getByLabel('What is wrong?').fill('Spindle alarm');

  const send = page.getByRole('button', { name: 'Send', exact: true });
  await expect(send).toBeEnabled();
  await expectTargetSize(send);
  await expectKeyboardFocus(send);
  await send.click();
  await expect(page.getByText('BD-0150', { exact: true })).toBeVisible();
  await expectTargetSize(page.getByRole('button', { name: 'Report another', exact: true }));
  await expectNoHorizontalOverflow(page);
  await captureEvidence(page, `docs/design/evidence/preview/floor-${width}.png`, capture);
}

async function captureDesk(width: number, page: Page, capture: boolean): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/design-preview');
  await page.getByRole('button', { name: 'Desk', exact: true }).click();
  await expect(page.getByText('Stopped · Not started', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: /^BD-0148/ }).click();

  const start = page.getByRole('button', { name: 'Start', exact: true });
  await expectTargetSize(start);
  await expectKeyboardFocus(start);
  await start.click();
  await expect(
    page
      .getByRole('region', { name: 'Working ticket' })
      .getByText('Stopped · In progress', { exact: true }),
  ).toBeVisible();

  const moreActions = page.getByText('More actions', { exact: true });
  await moreActions.focus();
  await moreActions.press('Enter');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Transfer', exact: true })).toBeVisible();
  const details = page.getByText('Timeline, people & figures', { exact: true });
  await details.focus();
  await details.press('Enter');
  for (const name of ['Timeline', 'People', 'Figures']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);
  await captureEvidence(page, `docs/design/evidence/preview/desk-${width}.png`, capture);
}

test('Floor sends a synthetic VC-17 stop without an API request', async ({ page }, testInfo) => {
  const apiRequests: string[] = [];
  const capture = testInfo.project.name === 'chromium';
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
  });
  for (const width of VIEWPORTS) await captureFloor(width, page, capture);
  expect(apiRequests).toEqual([]);
});

test('Desk starts a synthetic stop and exposes actions and details by keyboard', async ({
  page,
}, testInfo) => {
  const capture = testInfo.project.name === 'chromium';
  for (const width of VIEWPORTS) await captureDesk(width, page, capture);
});
