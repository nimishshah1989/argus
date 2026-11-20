import { expect, test } from '@playwright/test';

/**
 * The rail opens to 212 px over the page while the pointer is on it, and a machine chip in the first column of a table
 * sits under that open rail. A pointer left on the rail (a new page's pointer starts at the corner) must not strand the
 * chip: moving the pointer onto the page closes the rail and the chip opens its machine.
 */
test('a machine chip under the open rail opens once the pointer leaves the rail', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/gallery?view=v2-action-center&theme=light');
  await expect(page.getByRole('heading', { level: 1, name: 'Action Center' })).toBeVisible();
  const risk = page.getByRole('region', { name: 'Machines needing attention' });
  const chip = risk.getByRole('button', { name: 'HMC-2', exact: true }).first();
  await chip.scrollIntoViewIfNeeded();
  const rail = page.locator('.v2-rail');
  await page.mouse.move(10, 10);
  await expect
    .poll(() => rail.evaluate((e) => e.getBoundingClientRect().width))
    .toBeGreaterThan(200);
  await page.mouse.move(720, 450);
  await expect.poll(() => rail.evaluate((e) => e.getBoundingClientRect().width)).toBeLessThan(100);
  await chip.click({ timeout: 15_000 });
  await expect(page).toHaveURL(/drawer=machine:HMC-2/);
});
