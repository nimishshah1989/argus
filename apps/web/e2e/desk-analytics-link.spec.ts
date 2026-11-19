import { expect, test } from './test.js';
import { signIn } from './fixtures.js';

/**
 * Owner ruling (19 Nov): the desk menu links to Analytics for exactly the roles the analytics shell opens for
 * (`canAnalytics`): supervisor, head, plant head and admin. Operators, technicians and the board login do not get it.
 * The desk menu is the wide one (from 1024 px).
 */
const WITH_LINK = ['sup', 'head', 'ph', 'admin'] as const;
const WITHOUT_LINK = ['asha', 'op', 'brd'] as const;

for (const login of WITH_LINK)
  test(`${login} sees the Analytics entry on the desk menu and it opens Today`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, login);
    await page.goto('/desk');
    const entry = page
      .getByRole('navigation', { name: 'Desk' })
      .getByRole('link', { name: 'Analytics', exact: true });
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page).toHaveURL(/\/analytics\/today$/);
  });

for (const login of WITHOUT_LINK)
  test(`${login} has no Analytics entry on the desk menu`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, login);
    await page.goto('/desk');
    await expect(page.getByRole('link', { name: 'Analytics', exact: true })).toHaveCount(0);
  });
