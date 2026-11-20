import type { ActionCenterBoardReply } from '@uptimo/shared';
import { expect, test } from './test.js';
import { MACHINES, signIn } from './fixtures.js';

/**
 * The v2 Action Center is live at `/analytics/today/action-center` on the real server. The seed holds no breakdowns, so
 * the real board has no nudge: the page is opened once as it is, and once with the board's GET answering one nudge on a
 * real machine, so a machine chip can open the plant's own machine in the drawer.
 */
const MACHINE = MACHINES[0]!;

const BOARD: ActionCenterBoardReply = {
  asOf: '2026-11-11',
  snoozeDays: 7,
  types: {} as ActionCenterBoardReply['types'],
  nudges: [
    {
      key: 'freq|VC-1',
      rule: 'freq',
      sev: 'high',
      title: 'VC-1 has broken down 12 times in 30 days',
      machines: [MACHINE.id],
      entries: 12,
      status: 'open',
      reopened: false,
      ev: '2026-11-10',
      excluded: false,
      ack: null,
    },
  ],
  counts: { open: 1, ack: 0, snoozed: 0, resolved: 0 },
  bySeverity: { high: 1, med: 0, low: 0, info: 0 },
  risk: [],
};

test('the Action Center opens at its v1 address on the real server; a machine opens in the drawer and Back closes it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'head');

  // The real board: nothing open, and no error.
  await page.goto('/analytics/today/action-center');
  await expect(page.getByRole('heading', { level: 1, name: 'Action Center' })).toBeVisible();
  await expect(page.getByText('Nothing needs attention with the current limits.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  // One nudge on a real machine: its chip opens that machine, and Back closes it.
  await page.route('**/api/v1/analytics/action-center', (route) => route.fulfill({ json: BOARD }));
  await page.goto('/analytics/today/action-center');
  const nudge = page.locator('[data-nudge="freq|VC-1"]');
  await nudge.getByRole('button', { name: MACHINE.code, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`[?&]drawer=machine:${MACHINE.code}`));
  const drawer = page.locator('aside.v2-drawer');
  await expect(drawer).not.toHaveAttribute('inert', '');
  await expect(drawer.getByText('We could not find this one', { exact: false })).toHaveCount(0);
  await page.goBack();
  await expect(drawer).toHaveAttribute('inert', '');
  await expect(page).not.toHaveURL(/drawer=/);
});

test('an operator is refused the Action Center', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'op');
  await page.goto('/analytics/today/action-center');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('[data-nudge]')).toHaveCount(0);
});
