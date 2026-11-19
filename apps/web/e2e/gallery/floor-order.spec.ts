import { expect, test, type Page } from '@playwright/test';
import { controlOrder, mockFloor } from './floor-mock.js';

/**
 * LOCK.md rule 1 (ticket 89a): the new look never moves a control on the floor phone. These lists were read off
 * the floor screens BEFORE the restyle (same invented plant, `floor-mock.ts`, one refused close in the Drafts
 * card) and are written out in full; a restyle that reorders, adds or drops a control, a tab or a heading fails
 * here. No database: the API is answered in the browser. 360 x 740, light and dark.
 */
const HEAD = ['button: Account', 'h2: Needs attent', 'button: Dismiss'];
const TABS = ['a: Report', 'a: My complaint'];
const TABS_PM = [...TABS, 'a: PM jobs'];

const BROWSE = [
  ...HEAD,
  'h2: Report a pro',
  'h3: Which machin',
  'input: Find a machi',
  'button: CNC-01',
  'button: DRL-04',
  'button: Other work (',
  'button: CNCCNC lathe',
  'button: DRLDrills1 m',
  'button: CMPCompresso',
  ...TABS,
];
const SEARCH = [
  ...HEAD,
  'h2: Report a pro',
  'h3: Which machin',
  'input: Find a machi',
  'button: CNC-01CNC la',
  'button: CNC-02Needs ',
  'button: CNC-03CNC la',
  ...TABS,
];
const GROUP = [
  ...HEAD,
  'button: Groups',
  'h2: Report a pro',
  'h3: CNC CNC lath',
  'input: Machine ID',
  'button: CNC-01CNC la',
  'button: CNC-02Needs ',
  'button: CNC-03CNC la',
  ...TABS,
];
const SITUATION = [
  ...HEAD,
  'button: Machine',
  'h2: Report a pro',
  'h3: What is the ',
  'button: Machine has ',
  'button: Running, nee',
  ...TABS,
];
const SITUATION_SUPPORT = [
  ...HEAD,
  'button: Machine',
  'h2: Report a pro',
  'h3: What is the ',
  'button: Machine has ',
  'button: Still runnin',
  ...TABS,
];
const PROBLEM = [
  ...HEAD,
  'button: Type',
  'h2: Report a pro',
  'h3: What is wron',
  'textarea: What is wron',
  'button: Spindle alar',
  'button: Coolant leak',
  'button: Hydraulic pr',
  'button: Send: machin',
  ...TABS,
];
const PROBLEM_TECH = [
  ...HEAD,
  'button: Type',
  'h2: Report a pro',
  'h3: What is wron',
  'textarea: What is wron',
  'button: Spindle alar',
  'button: Coolant leak',
  'button: Hydraulic pr',
  'input: I am startin',
  'button: Send: machin',
  ...TABS_PM,
];
const SENT = [
  ...HEAD,
  'h2: Report a pro',
  'h3: Sent to main',
  'button: Report anoth',
  'button: See my compl',
  ...TABS,
];
const OTHER = [
  ...HEAD,
  'button: Report',
  'h2: Report a pro',
  'h3: Other work (',
  'select: Where?',
  'input: Or type the ',
  'select: Type of work',
  'textarea: What is need',
  'button: Normal',
  'button: Urgent',
  'button: Send work re',
  ...TABS,
];
const OTHER_TECH = [
  ...HEAD,
  'button: Report',
  'h2: Report a pro',
  'h3: Other work (',
  'select: Where?',
  'input: Or type the ',
  'select: Type of work',
  'textarea: What is need',
  'button: Normal',
  'button: Urgent',
  'input: I am startin',
  'button: Send work re',
  ...TABS_PM,
];
const MINE = [
  ...HEAD,
  'h2: My complaint',
  'button: Cancel',
  'h3: Is it fixed?',
  'button: Yes, it is f',
  'button: Not fixed',
  ...TABS,
];
const DISPUTE = [
  ...MINE,
  'h2: Not fixed',
  'button: Close',
  'textarea: What is stil',
  'button: Send back to',
  'button: Cancel',
];
const CANCEL = [
  ...MINE,
  'h2: Cancel the t',
  'button: Close',
  'textarea: Why cancel?',
  'button: Cancel ticke',
];
const MINE_TECH = [...HEAD, 'h2: My complaint', 'button: Cancel', 'button: Cancel', ...TABS_PM];
const PM = [...HEAD, 'h2: PM jobs', 'a: CMP-01Booked', 'a: CNC-01In pro', ...TABS_PM];

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
