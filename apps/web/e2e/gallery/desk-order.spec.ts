import { expect, test } from '@playwright/test';
import { controlOrder, mockDesk, TICKETS } from './desk-mock.js';

/**
 * LOCK.md rule 1 (ticket 88a), redrawn for the v2 Shell (ADR 0055 point 2, ADR 0056, S28/S29 approved 26 Nov): a
 * restyle never moves a control by accident. These lists are the approved order, written out in full; a change that
 * reorders, adds or drops a control, a tab or a heading fails here. No database: the API is answered in the browser.
 */
const RAIL = [
  'a: Today',
  'a: Machines',
  'a: Problems',
  'a: Reliability ',
  'a: People & mon',
  'a: Reports',
  'a: Guide',
  'a: Desk',
  'button: Menu',
];
const HEADER = ['button: Search⌘ K', 'button: Alerts'];
const TABS = [
  'button: Open (3)',
  'button: Mine',
  'button: Team',
  'button: Live',
  'a: Report a pro',
  'button: Account',
];
const OPEN_BODY = [
  'button: 2Down',
  'button: 1Waiting',
  'button: 1Support',
  'button: 0Running OK',
  'h2: Waiting for ',
  'a: Team now: 1 ',
  'button: Breakdowns (',
  'button: Tasks (0)',
  'button: Work (1)',
  'h2: Breakdowns (',
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
const OPEN = [...RAIL, 'h1: Open', ...HEADER, ...TABS, ...OPEN_BODY];
const MINE = [
  ...RAIL,
  'h1: My tickets',
  ...HEADER,
  ...TABS,
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
  ...RAIL,
  'h1: Team now',
  ...HEADER,
  ...TABS,
  'h2: Working now',
  'a: T-B1DRL-04Ra',
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
  ...RAIL,
  'h1: DRL-04 · T-B',
  ...HEADER,
  'a: ← Open ticke',
  'h2: Actions',
  'button: Write report',
  'button: Add me as su',
  'button: Pause: waiti',
  'button: Transfer',
  'button: Machine runn',
  'button: Post update',
  'button: Close withou',
  'button: Cancel ticke',
  'a: Send on What',
  'h2: SLA timers',
  'h2: Minutes',
  'h2: Facts',
  'h2: Who worked o',
  'h2: Full history',
];
const CLOSED = [
  ...RAIL,
  'h1: CNC-01 · T-D',
  ...HEADER,
  'a: ← Open ticke',
  'h3: Breakdown re',
  'button: Fill report',
  'a: Send on What',
  'h2: SLA timers',
  'h2: Minutes',
  'h2: Facts',
  'h2: Who worked o',
  'h2: Full history',
];
/** The ticket opened from the Open list on a wide screen: the kit side panel beside the list (ADR 0056 point 4). */
const BESIDE = [
  'button: Close',
  'a: ← Open ticke',
  'h2: CNC-01 · T-A',
  'h2: Actions',
  'button: Start work',
  'button: Cancel ticke',
  'a: Send on What',
  'h2: SLA timers',
  'h2: Facts',
  'h2: Who worked o',
  'h2: Full history',
  'a: Open full pa',
];

const PHONE = { width: 360, height: 740 };
const WIDE = { width: 1440, height: 900 };

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`desk control order, ${scheme}`, () => {
    test.use({ viewport: PHONE, colorScheme: scheme });

    test('phone: Open, Mine, Team and the ticket page keep their order', async ({ page }) => {
      await mockDesk(page);
      const screens: [string, string[]][] = [
        ['/desk', OPEN],
        ['/desk/mine', MINE],
        ['/desk/team', TEAM],
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
        await expect.poll(() => controlOrder(page)).toEqual(OPEN);
        await page.getByRole('link', { name: /^CNC-01\s*T-A1/ }).click();
        await expect(page.getByRole('heading', { name: /CNC-01 · T-A1/ })).toBeVisible();
        await expect.poll(() => controlOrder(page)).toEqual([...OPEN, ...BESIDE]);
        // By link, the same ticket is its own page in the Shell.
        await page.goto(`/desk/${TICKETS.working}`);
        await expect.poll(() => controlOrder(page)).toEqual(WORKING);
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
