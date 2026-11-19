import { expect, test, type Page } from '@playwright/test';
import { controlOrder, mockFloor } from './floor-mock.js';
import {
  BROWSE,
  CANCEL,
  DISPUTE,
  GROUP,
  MINE,
  MINE_TECH,
  OTHER,
  OTHER_TECH,
  PM,
  PROBLEM,
  PROBLEM_TECH,
  SEARCH,
  SENT,
  SITUATION,
  SITUATION_SUPPORT,
} from './floor-order-lists.js';

/**
 * LOCK.md rule 1 (ticket 89a): the new look never moves a control on the floor phone. These lists were read off
 * the floor screens BEFORE the restyle (same invented plant, `floor-mock.ts`, one refused close in the Drafts
 * card) and are written out in full, in `floor-order-lists.ts` (with each control's third of the screen); a restyle that reorders, adds or drops a control, a tab or a heading fails
 * here. No database: the API is answered in the browser. 360 x 740, light and dark.
 */
async function settled(page: Page, expected: string[], message: string): Promise<void> {
  await expect(page.getByRole('heading').first()).toBeVisible();
  await expect.poll(() => controlOrder(page), { message }).toEqual(expected);
}

const open = async (page: Page, path: string, expected: string[]): Promise<void> => {
  await page.goto(path);
  await settled(page, expected, path);
};

async function stopped(page: Page): Promise<void> {
  await page.goto('/floor?m=CNC-01');
  await page.getByRole('button', { name: /^Machine has stopped/ }).click();
}

const PHONE = { width: 360, height: 740 };

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`floor control order, ${scheme}`, () => {
    test.use({ viewport: PHONE, colorScheme: scheme });

    test('report a breakdown: every step keeps its order', async ({ page }) => {
      await mockFloor(page, { recent: true, draft: true });
      await open(page, '/floor', BROWSE);
      await page.getByLabel('Find a machine').fill('cnc');
      await settled(page, SEARCH, 'search');
      await page.getByLabel('Find a machine').fill('');
      await page.getByRole('button', { name: /^CNC CNC lathes/ }).click();
      await settled(page, GROUP, 'group');
      await open(page, '/floor?m=CNC-01', SITUATION);
      await open(page, '/floor?m=CNC-02', SITUATION_SUPPORT);
      await stopped(page);
      await settled(page, PROBLEM, 'problem');
      await page.getByRole('button', { name: 'Spindle alarm' }).click();
      await page.getByRole('button', { name: /^Send/ }).click();
      await settled(page, SENT, 'sent');
    });

    test('other work and My complaints, with the sign-off and cancel sheets', async ({ page }) => {
      await mockFloor(page, { draft: true });
      await open(page, '/floor/other', OTHER);
      await open(page, '/floor/mine', MINE);
      await page.getByRole('button', { name: 'Not fixed' }).click();
      await settled(page, DISPUTE, 'dispute sheet');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Cancel' }).first().click();
      await settled(page, CANCEL, 'cancel sheet');
    });

    test('maintenance sees the PM jobs tab and the start-now box', async ({ page }) => {
      await mockFloor(page, { role: 'technician', draft: true });
      await open(page, '/floor/pm', PM);
      await stopped(page);
      await settled(page, PROBLEM_TECH, 'problem, maintenance');
      await open(page, '/floor/mine', MINE_TECH);
      await open(page, '/floor/other', OTHER_TECH);
    });
  });
}
