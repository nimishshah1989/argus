import { expect, test } from '@playwright/test';
import { controlOrder, mockDesk, TICKETS } from './desk-mock.js';

/**
 * LOCK.md rule 1 (ticket 88a): the new look never moves a control. These lists were read off the desk screens
 * BEFORE the restyle (same invented plant, `desk-mock.ts`) and are written out in full; a restyle that reorders,
 * adds or drops a control, a tab or a heading fails here. No database: the API is answered in the browser.
 */
const TABS = ['a: 3Open', 'a: Mine', 'a: Team', 'a: Report', 'a: Live'];
const OPEN = [
  'h1: Open',
  'button: Account',
  'button: 2Down',
  'button: 1Waiting',
  'button: 1Support',
  'button: 0Running OK',
  'h2: Waiting for ',
  'a: Team now: 1 ',
  'button: Breakdowns (',
  'button: Tasks (0)',
  'button: Work (1)',
  'a: CNC-01T-A1S2',
  'button: Start work',
  'a: CNC-02T-A2S3',
  'button: Start work',
  'h2: Waiting (1)',
  'a: GRD-07T-C1S2',
  'button: Resume work',
  'h2: Closed witho',
  'a: CNC-01T-D1Ne',
  'a: Fill report',
];
const MINE = [
  'h1: My tickets',
  'button: Account',
  'h2: In progress',
  'a: DRL-04T-B1S2',
  'button: Machine runn',
  'h2: Waiting',
  'a: GRD-07T-C1S2',
  'button: Resume work',
  'h2: Closed, last',
  'a: T-D1CNC-01CN',
  'a: Day report',
];
const TEAM = [
  'h1: Team now',
  'button: Account',
  'h2: Working now',
  'a: T-B1DRL-04',
  'h2: Waiting',
  'a: T-C1GRD-07sp',
  'h2: Not started',
  'a: T-A1CNC-01Sp',
  'a: T-A2CNC-02Co',
  'a: T-W1—Fix the',
  'h2: Cancelled, l',
  'h2: Closed, last',
  'a: T-D1CNC-01CN',
  'h3: Monthly tota',
];
const WORKING = [
  'a: Open tickets',
  'h1: DRL-04T-B1',
  'h2: SLA timers',
  'a: Send on What',
  'h2: Minutes',
  'h2: Who worked o',
  'h2: Full history',
  'h2: Actions',
  'button: Write report',
  'button: Add me as su',
  'button: Pause: waiti',
  'button: Transfer',
  'button: Machine runn',
  'button: Post update',
  'button: Close withou',
  'button: Cancel ticke',
];
const CLOSED = [
  'a: Open tickets',
  'h1: CNC-01T-D1',
  'h2: SLA timers',
  'a: Send on What',
  'h2: Minutes',
  'h2: Who worked o',
  'h2: Full history',
  'h3: Breakdown re',
  'button: Fill report',
];
const SIDE = [
  'a: Open3',
  'a: Mine',
  'a: Team',
  'a: Report',
  'a: Live',
  'a: Analytics',
  'button: Account',
];

const PHONE = { width: 360, height: 740 };
const WIDE = { width: 1440, height: 900 };

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`desk control order, ${scheme}`, () => {
    test.use({ viewport: PHONE, colorScheme: scheme });

    test('phone: Open, Mine, Team and the ticket detail keep their order', async ({ page }) => {
      await mockDesk(page);
      const screens: [string, string[]][] = [
        ['/desk', [...OPEN, ...TABS]],
        ['/desk/mine', [...MINE, ...TABS]],
        ['/desk/team', [...TEAM, ...TABS]],
        [`/desk/${TICKETS.working}`, WORKING],
        [`/desk/${TICKETS.closed}`, CLOSED],
      ];
      for (const [path, expected] of screens) {
        await page.goto(path);
        await expect(page.getByRole('heading').first()).toBeVisible();
        await expect.poll(() => controlOrder(page), { message: path }).toEqual(expected);
      }
    });

    test.describe('desktop', () => {
      test.use({ viewport: WIDE });

      test('Open with the ticket beside it keeps its order', async ({ page }) => {
        await mockDesk(page);
        await page.goto('/desk');
        await expect(page.getByRole('heading', { name: 'Open', level: 1 })).toBeVisible();
        await expect
          .poll(() => controlOrder(page))
          .toEqual([...SIDE, 'h1: Open', ...OPEN.slice(2)]);
        await page.goto(`/desk/${TICKETS.working}`);
        await expect(page.getByRole('heading', { name: /DRL-04/ })).toBeVisible();
        await expect
          .poll(() => controlOrder(page))
          .toEqual([...SIDE, 'h1: Open', ...OPEN.slice(2), ...WORKING]);
      });
    });
  });
}

test('a technician session acts as the technician: Mine lists their own job only', async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await mockDesk(page, 'technician');
  await page.goto('/desk/mine');
  await expect(page.getByRole('heading', { name: 'My tickets', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /^CNC-02\s*T-F1/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^DRL-04\s*T-B1/ })).toHaveCount(0);
});
