/** The e2e's 'phone' project (a Pixel 5) runs the Action Center journey; this keeps its form journey in the gallery too. */
import { devices, expect, test, type Page } from '@playwright/test';

test.use({ ...devices['Pixel 5'] });
const FREQ = 'HMC-2 has broken down 12 times in 30 days';
const MTTR = 'TC-30: repairs take 4.24 hrs on average, 2.3x the fleet average';
const drawer = (page: Page) => page.locator('aside.v2-drawer');
const list = (page: Page) => page.getByRole('region', { name: 'Nudges', exact: true });
async function openNudge(page: Page, title: string) {
  await list(page)
    .getByRole('button', { name: `Open ${title}` })
    .click();
  await expect(drawer(page)).toHaveAttribute('aria-label', title);
}

for (const wide of [true, false]) {
  test(`phone emulation at ${wide ? 1440 : 'the device'} width: a nudge's form is its own, and its fields have their labels`, async ({
    page,
  }) => {
    if (wide) await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/gallery?view=v2-action-center&theme=light');
    await expect(page.getByRole('heading', { level: 1, name: 'Action Center' })).toBeVisible();
    const form = (p: Page) => p.getByRole('form', { name: 'Acknowledge nudge', exact: true });
    await openNudge(page, FREQ);
    await drawer(page).getByRole('button', { name: 'Acknowledge', exact: true }).click();
    await expect(form(page)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await openNudge(page, MTTR);
    await expect(form(page)).toHaveCount(0);
    await drawer(page).getByRole('button', { name: 'Acknowledge', exact: true }).click();
    await expect(form(page)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await openNudge(page, FREQ);
    await drawer(page).getByRole('button', { name: 'Acknowledge', exact: true }).click();
    const inDrawer = drawer(page).getByRole('form', { name: 'Acknowledge nudge', exact: true });
    await expect(inDrawer).toHaveCount(1, { timeout: 8000 });
    // Each field is reached by its own label (a label that wrapped the control read as "Owner No owner" on a phone).
    await inDrawer.getByLabel('Owner', { exact: true }).selectOption('Asha');
    await inDrawer.getByLabel('Due date', { exact: true }).fill('2026-11-20');
    await inDrawer.getByLabel('Note', { exact: true }).fill('Check the bearing');
    await expect(
      inDrawer.getByRole('button', { name: 'Save acknowledgement', exact: true }),
    ).toBeVisible();
  });
}
