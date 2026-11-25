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
/** Opens a nudge from its row and waits for its own drawer, so a later click never lands on the one it replaces. */
async function openNudge(page: Page, title: string): Promise<void> {
  await opener(page, title).click();
  await expect(drawer(page)).toHaveAttribute('aria-label', title);
}
/**
 * Closes the open drawer with its Close button (a phone has no Escape key) and waits until it is closed: the close is a
 * step Back in the history, which lands a moment later, so a click or a reload straight after could still find the
 * drawer's address (and a click on the open nudge's own row closes it again). The button is waited for, so this never
 * acts before the drawer has mounted its key handler. Esc is covered by the gallery's 'Esc and the ✕ each close it in
 * one history step' (v2-entity-links.spec.ts) and by v2-action-center.spec.ts.
 */
async function closeDrawer(page: Page): Promise<void> {
  await drawer(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page).not.toHaveURL(/drawer=/);
  await expect(drawer(page)).toHaveAttribute('inert', '');
}

const FREQ = 'VC-1 has broken down 12 times in 30 days';
const MTTR = 'VC-3: repairs take 4.24 hrs on average, 2.3x the fleet average';
const GOOD = 'Downtime this week is 52% below the recent weekly average';

async function openScreen(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubBoard(page);
  await signIn(page, 'head');
  // The Today banner (action strips since sweep #706) reads the same board and opens the screen.
  await expect(page.locator('.v2-banner-text, .v2-strip').first()).toContainText(
    /^2 high-priority/,
  );
  await page
    .getByRole('link', { name: /Open Action Center/ })
    .first()
    .click();
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
  // Each priority chip says how many rows it opens under the tab, the type and the search.
  for (const chip of ['All priorities 5', 'High priority 2', 'Medium 1', 'Low 1', 'Good news 1'])
    await expect(list(page).getByRole('button', { name: chip, exact: true })).toBeVisible();
  // The rail opens over the first column while the pointer is on it: park the pointer on the page.
  await page.mouse.move(200, 450);
  const risk = page.getByRole('region', { name: 'Machines needing attention' });
  await expect(risk.getByRole('row')).toHaveCount(2);
  await expect(risk).toContainText('Frequent breakdowns');
  await expect(risk).toContainText('VMC');
  await risk.getByRole('button', { name: 'VC-1', exact: true }).click();
  await expect(page).toHaveURL(/drawer=machine:VC-1/);
  await closeDrawer(page);
  const freq = rowOf(page, FREQ);
  for (const text of ['Frequent breakdowns', FREQ, '12', '10-Nov-2026'])
    await expect(freq).toContainText(text);
  // The row's machine is a chip that opens the machine, never a link to a database id.
  await expect(freq.getByRole('button', { name: 'VC-1', exact: true })).toBeVisible();
  await expect(list(page).getByRole('row')).toHaveCount(6);
  await openNudge(page, GOOD);
  await expect(drawer(page)).toHaveAttribute('aria-label', GOOD);
  await expect(
    drawer(page).getByRole('button', { name: /Acknowledge|Snooze|Resolved/ }),
  ).toHaveCount(0);
  await closeDrawer(page);
  const type = page.getByLabel('Type', { exact: true });
  await type.selectOption('recur');
  await expect(list(page).getByRole('row')).toHaveCount(2);
  await expect(list(page)).toContainText('ATC (Automatic Tool Changer)');
  await type.selectOption('');
  await expect(list(page).getByRole('row')).toHaveCount(6);
}

async function ackAndReload(page: Page): Promise<void> {
  // One form at a time: a nudge opens alone in the drawer, so another nudge's form never stands beside it, and a form
  // opened on one nudge is not there when the next is opened (on a phone the drawer covers the list, so it is closed first).
  await openNudge(page, FREQ);
  await drawer(page).getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Acknowledge nudge', exact: true })).toHaveCount(1);
  await closeDrawer(page);
  await openNudge(page, MTTR);
  await expect(page.getByRole('form', { name: 'Acknowledge nudge', exact: true })).toHaveCount(0);
  await drawer(page).getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Acknowledge nudge', exact: true })).toHaveCount(1);
  await closeDrawer(page);
  await openNudge(page, FREQ);
  await expect(page.getByRole('form', { name: 'Acknowledge nudge', exact: true })).toHaveCount(0);
  await drawer(page).getByRole('button', { name: 'Acknowledge', exact: true }).click();
  const form = drawer(page).getByRole('form', { name: 'Acknowledge nudge', exact: true });
  await form.getByLabel('Owner', { exact: true }).selectOption('Asha');
  await form.getByLabel('Due date', { exact: true }).fill('2026-11-20');
  await form.getByLabel('Note', { exact: true }).fill('Check the bearing');
  await form.getByRole('button', { name: 'Save acknowledgement', exact: true }).click();
  // The acked nudge leaves the Open tab; its own tab shows the stored status line.
  await closeDrawer(page);
  await tabs(page)
    .getByRole('button', { name: /^Acknowledged/ })
    .click();
  const freq = rowOf(page, FREQ);
  for (const text of ['Acknowledged', 'Asha', 'Due 20-Nov-2026', 'Note: Check the bearing'])
    await expect(freq).toContainText(text);
  await openNudge(page, FREQ);
  await expect(drawer(page).getByRole('button', { name: 'Reopen', exact: true })).toBeVisible();
  await closeDrawer(page);
  await page.reload();
  await tabs(page)
    .getByRole('button', { name: /^Acknowledged/ })
    .click();
  await expect(rowOf(page, FREQ)).toContainText('Asha');
  await expect(rowOf(page, FREQ)).toContainText('Note: Check the bearing');
}

async function snoozeAndReopen(page: Page): Promise<void> {
  await tabs(page).getByRole('button', { name: /^Open/ }).click();
  await openNudge(page, MTTR);
  await drawer(page).getByRole('button', { name: 'Snooze 7 days', exact: true }).click();
  // A snoozed nudge leaves the Open tab; its own tab shows the snooze day.
  await closeDrawer(page);
  await tabs(page)
    .getByRole('button', { name: /^Snoozed/ })
    .click();
  await expect(rowOf(page, MTTR)).toContainText('Snoozed until 18-Nov-2026');
  await page.reload();
  await tabs(page)
    .getByRole('button', { name: /^Snoozed/ })
    .click();
  await expect(rowOf(page, MTTR)).toContainText('Snoozed until 18-Nov-2026');
  await openNudge(page, MTTR);
  await drawer(page).getByRole('button', { name: 'Reopen', exact: true }).click();
  await closeDrawer(page);
  await expect(rowOf(page, MTTR)).toHaveCount(0);
  await tabs(page).getByRole('button', { name: /^Open/ }).click();
  await openNudge(page, MTTR);
  await expect(
    drawer(page).getByRole('button', { name: 'Acknowledge', exact: true }),
  ).toBeVisible();
  // The drawer lives in the address: a reload brings the same nudge back open, with its buttons.
  await expect(page).toHaveURL(/drawer=decision:/);
  await page.reload();
  await expect(drawer(page)).toHaveAttribute('aria-label', MTTR);
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
