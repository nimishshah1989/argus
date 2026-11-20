import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type {
  ActionCenterBoardReply,
  BoardNudgeReply,
  NudgeAckReply,
  NudgeStatus,
} from '@uptimo/shared';
import { expect, test } from './test.js';
import { MACHINES, signIn } from './fixtures.js';

/**
 * 44d: the Action Center screen. A head opens the screen, sees the four tiles, the four tabs, the risk table and
 * one card per nudge, filters by type, acknowledges a nudge with owner, due and note, reloads and sees the ack
 * hold, snoozes another and sees the snooze hold after a reload, then reopens it. The board and its write routes
 * are stubbed with an in-test store (the face's established seam; the e2e seed has no breakdowns), so the journey
 * proves the screen and the 44c contract it calls. The real persistence is 44c's server test.
 */

const AS_OF = '2026-11-11';
const SNOOZE_DAYS = 7;
const SNOOZE_UNTIL = '2026-11-18T08:00:00.000Z';
const TYPES = (
  JSON.parse(
    readFileSync(
      new URL('../../../fixtures/answer-key/action-center.json', import.meta.url),
      'utf8',
    ),
  ) as { extra: { types: ActionCenterBoardReply['types'] } }
).extra.types;

interface Stored {
  status: 'ack' | 'snooze' | 'done';
  owner: string;
  due: string;
  note: string;
  at: string;
  until?: string;
}

type Nudge = Omit<BoardNudgeReply, 'status' | 'reopened' | 'ev' | 'excluded' | 'ack'>;

const NUDGES: Nudge[] = [
  {
    key: 'freq|VC-1',
    rule: 'freq',
    sev: 'high',
    title: 'VC-1 has broken down 12 times in 30 days',
    machines: [MACHINES[0]!.id],
    entries: 12,
  },
  {
    key: 'recur|VC-2|ATC',
    rule: 'recur',
    sev: 'high',
    title: 'VC-2: ATC (Automatic Tool Changer) came back on 2 different days in the last 7 days',
    machines: [MACHINES[1]!.id],
    entries: 2,
  },
  {
    key: 'mttr|VC-3',
    rule: 'mttr',
    sev: 'med',
    title: 'VC-3: repairs take 4.24 hrs on average, 2.3x the fleet average',
    machines: [MACHINES[2]!.id],
    entries: 3,
  },
  {
    key: 'shift|1',
    rule: 'shift',
    sev: 'low',
    title: 'Shift 1 had 61% of breakdowns in the last 30 days',
    machines: [],
    entries: 22,
  },
  {
    key: 'good|hrs',
    rule: 'good',
    sev: 'info',
    title: 'Downtime this week is 52% below the recent weekly average',
    machines: [],
    entries: 5,
  },
];

let store = new Map<string, Stored>();

function statusOf(key: string): NudgeStatus {
  const stored = store.get(key);
  if (stored === undefined) return 'open';
  if (stored.status === 'ack') return 'ack';
  if (stored.status === 'snooze') return 'snoozed';
  return 'resolved';
}

function board(): ActionCenterBoardReply {
  const nudges = NUDGES.map((nudge): BoardNudgeReply => {
    const ack = (store.get(nudge.key) ?? null) as NudgeAckReply | null;
    return {
      ...nudge,
      status: statusOf(nudge.key),
      reopened: false,
      ev: '2026-11-10',
      excluded: false,
      ack,
    };
  });
  const open = nudges.filter((nudge) => nudge.status === 'open');
  const count = (status: NudgeStatus) => nudges.filter((nudge) => nudge.status === status).length;
  const severity = (sev: string) => open.filter((nudge) => nudge.sev === sev).length;
  return {
    asOf: AS_OF,
    snoozeDays: SNOOZE_DAYS,
    types: TYPES,
    nudges,
    counts: {
      open: open.length,
      ack: count('ack'),
      snoozed: count('snoozed'),
      resolved: count('resolved'),
    },
    bySeverity: {
      high: severity('high'),
      med: severity('med'),
      low: severity('low'),
      info: severity('info'),
    },
    risk: [{ machine: MACHINES[0]!.id, model: 'VMC', score: 7, why: 'Frequent breakdowns' }],
  };
}

/** The board GET and the two write routes, over the in-test store; every write answers the fresh board. */
async function stubBoard(page: Page): Promise<void> {
  await page.route('**/api/v1/analytics/action-center', (route) =>
    route.fulfill({ json: board() }),
  );
  await page.route('**/api/v1/analytics/action-center/nudges/*', (route) => {
    const request = route.request();
    const key = decodeURIComponent(new URL(request.url()).pathname.split('/nudges/')[1] ?? '');
    if (request.method() === 'PUT') {
      const body = request.postDataJSON() as {
        status: 'ack' | 'snooze' | 'resolved';
        owner?: string;
        due?: string;
        note?: string;
      };
      const stored: Stored = {
        status: body.status === 'resolved' ? 'done' : body.status,
        owner: body.owner ?? '',
        due: body.due ?? '',
        note: body.note ?? '',
        at: new Date().toISOString(),
      };
      if (body.status === 'snooze') stored.until = SNOOZE_UNTIL;
      store.set(key, stored);
    } else if (request.method() === 'DELETE') {
      store.delete(key);
    }
    return route.fulfill({ json: board() });
  });
}

const tabs = (page: Page) => page.getByRole('group', { name: 'Action Center status' });
const list = (page: Page) => page.getByRole('region', { name: 'Nudges', exact: true });
const drawer = (page: Page) => page.locator('aside.v2-drawer');
const rowOf = (page: Page, title: string) => list(page).getByRole('row').filter({ hasText: title });
const opener = (page: Page, title: string) =>
  list(page).getByRole('button', { name: `Open ${title}` });
const FREQ = 'VC-1 has broken down 12 times in 30 days';
const MTTR = 'VC-3: repairs take 4.24 hrs on average, 2.3x the fleet average';
const GOOD = 'Downtime this week is 52% below the recent weekly average';

async function openScreen(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubBoard(page);
  await signIn(page, 'head');
  // The Today banner reads the same board and opens the screen.
  await expect(
    page.getByText('2 high-priority and 1 medium nudges need attention', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: /Open Action Center/ }).click();
  await expect(page).toHaveURL(/\/analytics\/today\/action-center$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Action Center' })).toBeVisible();
  await expect(
    page.getByText('Nudges worked out from the breakdown log', { exact: false }),
  ).toBeVisible();
}

async function assertBoard(page: Page): Promise<void> {
  for (const [name, count] of [
    ['High priority', '2'],
    ['Medium', '1'],
    ['Low', '1'],
    ['Good news', '1'],
  ] as const)
    await expect(page.getByRole('region', { name, exact: true })).toContainText(count);
  await expect(tabs(page).getByRole('button')).toHaveCount(4);
  await expect(tabs(page).getByRole('button', { name: /^Open/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const risk = page.getByRole('region', { name: 'Machines needing attention' });
  await expect(risk.getByRole('row')).toHaveCount(2);
  await expect(risk).toContainText('Frequent breakdowns');
  await expect(risk).toContainText('VMC');
  await risk.getByRole('button', { name: 'VC-1' }).click();
  await expect(page).toHaveURL(/drawer=machine:VC-1/);
  await page.keyboard.press('Escape');
  const freq = rowOf(page, FREQ);
  for (const text of ['Frequent breakdowns', FREQ, '12', '10-Nov-2026'])
    await expect(freq).toContainText(text);
  // The row's machine is a chip that opens the machine, never a link to a database id.
  await expect(freq.getByRole('button', { name: 'VC-1' })).toBeVisible();
  await expect(list(page).getByRole('row')).toHaveCount(6);
  await opener(page, GOOD).click();
  await expect(drawer(page)).toHaveAttribute('aria-label', GOOD);
  await expect(
    drawer(page).getByRole('button', { name: /Acknowledge|Snooze|Resolved/ }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  const type = page.getByLabel('Type', { exact: true });
  await type.selectOption('recur');
  await expect(list(page).getByRole('row')).toHaveCount(2);
  await expect(list(page)).toContainText('ATC (Automatic Tool Changer)');
  await type.selectOption('');
  await expect(list(page).getByRole('row')).toHaveCount(6);
}

async function ackAndReload(page: Page): Promise<void> {
  // One form at a time: a nudge opens alone in the drawer, so another nudge's form never stands beside it.
  await opener(page, FREQ).click();
  await drawer(page).getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await opener(page, MTTR).click();
  await drawer(page).getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Acknowledge nudge', exact: true })).toHaveCount(1);
  await opener(page, FREQ).click();
  await drawer(page).getByRole('button', { name: 'Acknowledge', exact: true }).click();
  const form = drawer(page).getByRole('form', { name: 'Acknowledge nudge', exact: true });
  await form.getByLabel('Owner', { exact: true }).selectOption('Asha');
  await form.getByLabel('Due date', { exact: true }).fill('2026-11-20');
  await form.getByLabel('Note', { exact: true }).fill('Check the bearing');
  await form.getByRole('button', { name: 'Save acknowledgement', exact: true }).click();
  // The acked nudge leaves the Open tab; its own tab shows the stored status line.
  await page.keyboard.press('Escape');
  await tabs(page)
    .getByRole('button', { name: /^Acknowledged/ })
    .click();
  const freq = rowOf(page, FREQ);
  for (const text of ['Acknowledged', 'Asha', 'Due 20-Nov-2026', 'Note: Check the bearing'])
    await expect(freq).toContainText(text);
  await opener(page, FREQ).click();
  await expect(drawer(page).getByRole('button', { name: 'Reopen', exact: true })).toBeVisible();
  await page.reload();
  await tabs(page)
    .getByRole('button', { name: /^Acknowledged/ })
    .click();
  await expect(rowOf(page, FREQ)).toContainText('Asha');
  await expect(rowOf(page, FREQ)).toContainText('Note: Check the bearing');
}

async function snoozeAndReopen(page: Page): Promise<void> {
  await tabs(page).getByRole('button', { name: /^Open/ }).click();
  await opener(page, MTTR).click();
  await drawer(page).getByRole('button', { name: 'Snooze 7 days', exact: true }).click();
  // A snoozed nudge leaves the Open tab; its own tab shows the snooze day.
  await page.keyboard.press('Escape');
  await tabs(page)
    .getByRole('button', { name: /^Snoozed/ })
    .click();
  await expect(rowOf(page, MTTR)).toContainText('Snoozed until 18-Nov-2026');
  await page.reload();
  await tabs(page)
    .getByRole('button', { name: /^Snoozed/ })
    .click();
  await expect(rowOf(page, MTTR)).toContainText('Snoozed until 18-Nov-2026');
  await opener(page, MTTR).click();
  await drawer(page).getByRole('button', { name: 'Reopen', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(rowOf(page, MTTR)).toHaveCount(0);
  await tabs(page).getByRole('button', { name: /^Open/ }).click();
  await opener(page, MTTR).click();
  await expect(
    drawer(page).getByRole('button', { name: 'Acknowledge', exact: true }),
  ).toBeVisible();
  await page.reload();
  await opener(page, MTTR).click();
  await expect(
    drawer(page).getByRole('button', { name: 'Acknowledge', exact: true }),
  ).toBeVisible();
}

test.beforeEach(() => {
  store = new Map<string, Stored>();
});

test('the Action Center: board rows, ack with owner, due and note, snooze and reopen across reloads', async ({
  page,
}) => {
  await openScreen(page);
  await assertBoard(page);
  await ackAndReload(page);
  await snoozeAndReopen(page);
});
