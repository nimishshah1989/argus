import { expect, test } from './test.js';
import { signIn } from './fixtures.js';

/**
 * 45f: the Guide. A head opens `/analytics/guide`, reads the key's contents, finds entry 14 "Reports (Monthly and
 * Annual)" and follows its first figure link to the Reports group, then comes back and follows the Dashboard
 * entry's first figure link to Today. The journey proves the headings and the links the screen builds from
 * `guide-entries.ts`; the entry rules themselves are pinned by `guide-entries.test.ts`, not by copied prose.
 */
test('a head opens the Guide, reads the Reports entry and follows its figure links', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'head');
  await page.goto('/analytics/guide');

  await expect(page.getByRole('heading', { name: 'Guide', exact: true })).toBeVisible();

  const contents = page.getByRole('navigation', { name: 'Contents', exact: true });
  await expect(contents.getByRole('link')).toHaveCount(36);

  const reports = page.locator('#guide-reports');
  await expect(
    page.getByRole('heading', { name: '14. Reports (Monthly and Annual)', exact: true }),
  ).toBeVisible();
  await expect(
    reports.getByText('The monthly report covers the calendar month', { exact: false }),
  ).toBeVisible();
  const monthly = reports.getByRole('link', { name: /Monthly report/ }).first();
  await expect(monthly).toHaveAttribute('href', /^\/analytics\/reports\?screen=monthly-report$/);
  await monthly.click();
  await expect(page).toHaveURL(/\/analytics\/reports\?screen=monthly-report$/);

  await page.goBack();
  const dashboard = page.locator('#guide-dashboard');
  const firstTile = dashboard.getByRole('link').first();
  await expect(firstTile).toHaveAttribute('href', /^\/analytics\/today\?screen=dashboard$/);
  await firstTile.click();
  await expect(page).toHaveURL(/\/analytics\/today\?screen=dashboard$/);

  await page.goto('/analytics/guide');
  // 50c built the PM calendar, so its entry now explains the screen; OEM is still unbuilt and keeps the line.
  await expect(page.locator('#guide-pm-calendar')).toContainText('preventive maintenance');
  await expect(page.locator('#guide-pm-calendar')).not.toContainText('not in this build yet');
  await expect(page.locator('#guide-oem')).toContainText('not in this build yet');
});
