import type { Page } from '@playwright/test';
import { addDays } from '@uptimo/shared';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { apiFetch, apiLogin, signIn } from './fixtures.js';
import {
  PLANT_TODAY,
  calendarDay,
  nextWorkingDay,
  pmCalendarMachine,
  pmCalendarTaskMachine,
} from './fixtures-pm-calendar.js';

/**
 * 50c: the PM calendar screen. A head opens `/analytics/pm`, reads the two compliance tiles, sees the month's two
 * crowded plans, drags one to a free working day and finds it there after a reload, then opens the machine page
 * whose Tasks block lists that machine's open work request and PM job. An operator is refused the screen and the
 * write. The figures reply is stubbed (the established seam); the calendar, the reschedule and the ticket list are
 * the real APIs, so the drag proves the write and the reload proves it survived.
 */

type Figure = FiguresReply['figures'][number];

const COMPLIANCE = {
  from: '2026-01-01',
  to: PLANT_TODAY,
  pm: {
    eligible: 8,
    onTime: 2,
    early: 1,
    late: 2,
    overdue: 2,
    cancelled: 1,
    pending: 1,
    pct: 25,
  },
  schedule: { eligible: 11, done: 3, missed: 8, pending: 0, pct: 27.3 },
};

/** The machine page's record: enough for the nameplate and its blocks; the Tasks block is the live list. */
function machineFigure(machine: {
  id: string;
  code: string;
  category: string;
  cell: string;
}): Figure {
  return {
    key: 'machine-page',
    screen: 'machine-page',
    owner: 39,
    status: 'ready',
    value: {
      byMachine: {
        [machine.id]: {
          machine: { code: machine.code, category: machine.category, cell: machine.cell },
          breakdowns: { count: 0 },
          completeness: { recorded: 1, of: 1, missing: [] },
        },
      },
    },
    drill: { type: 'machine', ids: [] },
  };
}

function figuresFor(machine: {
  id: string;
  code: string;
  category: string;
  cell: string;
}): FiguresReply {
  return {
    asOf: PLANT_TODAY,
    profile: {} as FiguresReply['profile'],
    excludedMachines: 0,
    rows: { machines: 3, moves: 0, tickets: 2, tasks: 0, reports: 0, people: 0 },
    figures: [
      {
        key: 'pm-compliance',
        screen: 'pm-calendar',
        owner: 50,
        status: 'ready',
        value: COMPLIANCE,
        drill: { type: 'ticket', ids: [] },
      },
      machineFigure(machine),
    ],
  };
}

async function stubFigures(page: Page, reply: FiguresReply): Promise<void> {
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: reply }));
}

/** The plant's day as the page prints it (DD-MM-YYYY). */
const shownDay = (day: string): string => day.split('-').reverse().join('-');

/** FullCalendar's own cell for a day; the library's class names are hashed, `[data-date]` is the stable hook. */
const cellOf = (page: Page, day: string) => page.locator(`[data-date="${day}"]`).first();

/** The day cell under a point, read from the page itself: the pointer's real target, not a measured guess. */
const dayUnder = (page: Page, x: number, y: number): Promise<string | null> =>
  page.evaluate(
    ([px, py]) =>
      document
        .elementsFromPoint(px!, py!)
        .find((element) => element.hasAttribute('data-date'))
        ?.getAttribute('data-date') ?? null,
    [x, y],
  );

/**
 * Holds the pointer over `day`'s cell until the page itself says the pointer is on it. The month's second fetch
 * (the six-week grid) can grow a row after the cell was measured, so one measurement may land a row away; each
 * pass measures again, and the drop happens only on the day asked for.
 */
async function hoverDay(page: Page, day: string): Promise<void> {
  for (let pass = 0; pass < 8; pass += 1) {
    const box = await cellOf(page, day).boundingBox();
    if (box) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y, { steps: 10 });
      if ((await dayUnder(page, x, y)) === day) return;
    }
    await page.waitForTimeout(150);
  }
  throw new Error(`the pointer never settled on ${day}`);
}

async function dragEvent(page: Page, code: string, day: string): Promise<void> {
  // Both fetches of the month have landed, so no row grows under the pointer.
  await page.waitForLoadState('networkidle');
  const event = page.getByText(code, { exact: true }).first();
  const cell = cellOf(page, day);
  // The tiles sit above the grid: on a laptop the month's last rows start below the fold.
  await event.scrollIntoViewIfNeeded();
  await expect(event).toBeVisible();
  await expect(cell).toBeVisible();
  const from = await event.boundingBox();
  if (!from) throw new Error(`cannot drag ${code} onto ${day}: no box`);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // A first nudge inside the event starts FullCalendar's drag; jumping straight to the target can outrun it.
  await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 20, { steps: 5 });
  await page.waitForTimeout(200);
  await hoverDay(page, day);
  await page.mouse.up();
}

/** One Sunday visible in the grid (the server's refusal), preferring a future one. */
async function visibleSunday(page: Page): Promise<string> {
  const days = await page
    .locator('[data-date]')
    .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-date') ?? ''));
  const sundays = days.filter(
    (day) => /^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(`${day}T00:00:00Z`).getUTCDay() === 0,
  );
  const chosen =
    sundays.find((day) => day > PLANT_TODAY) ?? sundays.find((day) => day < PLANT_TODAY);
  if (!chosen) throw new Error('the grid has no Sunday to refuse');
  return chosen;
}

/** The month's two plans, both crowded, with the two compliance tiles above them. */
async function readMonth(page: Page, machine: { code: string }): Promise<void> {
  await page.goto('/analytics/pm');
  await expect(page.getByRole('heading', { name: 'PM calendar', exact: true })).toBeVisible();
  await expect(page.getByText('25.0 %', { exact: true })).toBeVisible();
  await expect(page.getByText('27.3 %', { exact: true })).toBeVisible();
  await expect(page.getByText('2 of 8 PM jobs on time', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Spread the load', exact: true })).toBeVisible();
  await expect(page.locator(`[data-crowded="${machine.code}"]`)).toBeVisible();
  // Each of the fixture's two crowded plans offers its nearest free working day; no other day is ours to move.
  for (const code of ['PMC-1', 'PMC-2']) {
    await expect(
      page.locator(`[data-crowded="${code}"]`).getByRole('button', { name: /^Move to / }),
    ).toBeVisible();
  }
  await expect(cellOf(page, PLANT_TODAY).getByText(machine.code, { exact: true })).toBeVisible();
}

/** The drag's write, the redraw and the audit note. */
async function dragTo(
  page: Page,
  machine: { id: string; code: string },
  target: string,
): Promise<void> {
  const saved = page.waitForResponse(
    (reply) =>
      reply.request().method() === 'POST' &&
      new URL(reply.url()).pathname === '/api/v1/pm/reschedule' &&
      reply.status() === 200,
  );
  await dragEvent(page, machine.code, target);
  const request = (await saved).request().postDataJSON() as Record<string, unknown>;
  expect(request).toMatchObject({ machineId: machine.id, scheduledOn: target });
  await expect(cellOf(page, target).getByText(machine.code, { exact: true })).toBeVisible();
  await expect(cellOf(page, PLANT_TODAY).getByText(machine.code, { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: `moved to ${shownDay(target)}` }),
  ).toBeVisible();
}

/** The move is the server's record: a reload still finds it on the target day, not the old one. */
async function reloadKeeps(page: Page, machine: { code: string }, target: string): Promise<void> {
  await page.reload();
  await expect(page.getByRole('heading', { name: 'PM calendar', exact: true })).toBeVisible();
  await expect(cellOf(page, target).getByText(machine.code, { exact: true })).toBeVisible();
  await expect(cellOf(page, PLANT_TODAY).getByText(machine.code, { exact: true })).toHaveCount(0);
}

/** A Sunday refusal (422) is announced with the server's words and the event snaps back. */
async function refuseSunday(page: Page, machine: { code: string }, target: string): Promise<void> {
  const sunday = await visibleSunday(page);
  await dragEvent(page, machine.code, sunday);
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(
    /PM jobs are scheduled Monday to Saturday|A PM job cannot be scheduled in the past/,
  );
  await expect(cellOf(page, target).getByText(machine.code, { exact: true })).toBeVisible();
}

/** The 15th of the month `offset` months from the plant's today: a day only that month's six-week grid shows. */
function midMonth(offset: number): string {
  const [year, month] = PLANT_TODAY.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, month - 1 + offset, 15)).toISOString().slice(0, 10);
}

/** Next month opens, stays open once its events arrive, and the grid does not snap back to today's month. */
async function nextMonth(page: Page): Promise<void> {
  const loaded = page.waitForResponse((reply) => {
    const url = new URL(reply.url());
    return (
      url.pathname === '/api/v1/pm/calendar' &&
      (url.searchParams.get('to') ?? '') >= midMonth(1) &&
      reply.status() === 200
    );
  });
  await page.getByRole('button', { name: /next/i }).click();
  await expect(cellOf(page, midMonth(1))).toBeVisible();
  await expect(cellOf(page, midMonth(0))).toHaveCount(0);
  await loaded;
  await expect(page.getByText('Loading the calendar…')).toHaveCount(0);
  await expect(cellOf(page, midMonth(1))).toBeVisible();
  await expect(cellOf(page, midMonth(0))).toHaveCount(0);
}

/** The machine page's live Tasks block, and the analytics blocks above it still drawn. */
async function openTasks(page: Page, machine: { id: string; code: string }): Promise<void> {
  await page.goto(`/analytics/machines/${machine.id}`);
  await expect(page.getByRole('heading', { name: machine.code, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible();
  await expect(page.getByText('Open tasks', { exact: true })).toBeVisible();
  await expect(page.getByText('PM tasks', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'WR-PMC3B', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'WR-PMC3', exact: true })).toBeVisible();
  await expect(page.getByText('Overdue', { exact: true })).toBeVisible();
  await expect(
    page.getByText(`Scheduled ${shownDay(calendarDay(-2))}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'PM visits and hours', exact: true }),
  ).toBeVisible();
}

// The plant head reads the crowded plans before the head's drag spreads them, so this file runs in order.
test.describe.configure({ mode: 'serial' });

test('a plant head reads the calendar and is offered no move', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  const machine = pmCalendarMachine(testInfo.project.name);
  await stubFigures(page, figuresFor(pmCalendarTaskMachine(testInfo.project.name)));
  await signIn(page, 'ph');
  await page.goto('/analytics/pm');
  await expect(page.getByRole('heading', { name: 'PM calendar', exact: true })).toBeVisible();
  await expect(cellOf(page, PLANT_TODAY).getByText(machine.code, { exact: true })).toBeVisible();
  // The crowded plan still names its nearest free day, in words; only the Move button is the head's.
  await expect(page.locator(`[data-crowded="${machine.code}"]`)).toContainText('Nearest free day');
  await expect(page.getByRole('button', { name: /^Move to / })).toHaveCount(0);
});

test('a head drags a PM to a free day, reads the tiles and opens a machine’s Tasks', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  const machine = pmCalendarMachine(testInfo.project.name);
  const taskMachine = pmCalendarTaskMachine(testInfo.project.name);
  const target = nextWorkingDay();
  await stubFigures(page, figuresFor(taskMachine));
  await signIn(page, 'head');
  await test.step('the month shows both plans, crowded, and the two compliance tiles', () =>
    readMonth(page, machine));
  await test.step('a drag writes the job and the month redraws it on the target day', () =>
    dragTo(page, machine, target));
  await test.step('the move survives a reload', () => reloadKeeps(page, machine, target));
  await test.step('a drag to a Sunday is refused with the server’s message and snaps back', () =>
    refuseSunday(page, machine, target));
  await test.step('next month opens and stays on the next month', () => nextMonth(page));
  await test.step('the machine page lists its open work request and PM job under Tasks', () =>
    openTasks(page, taskMachine));
});

/** The first Monday-Saturday after `day`: a day the server accepts. */
function workingDayAfter(day: string): string {
  let next = addDays(day, 1);
  while (new Date(`${next}T00:00:00Z`).getUTCDay() === 0) next = addDays(next, 1);
  return next;
}

/** Types a day into the focused native date field, in the order the browser's own locale lays its parts out. */
async function typeDay(page: Page, day: string): Promise<void> {
  const order = await page.evaluate(() =>
    new Intl.DateTimeFormat(navigator.language)
      .formatToParts(new Date(2000, 10, 22))
      .map((part) => part.type)
      .filter((type) => type === 'day' || type === 'month' || type === 'year'),
  );
  const [year, month, date] = day.split('-') as [string, string, string];
  const parts: Record<string, string> = { year, month, day: date };
  for (const type of order) await page.keyboard.type(parts[type] ?? '');
}

// The calendar's drag has no keyboard, so every movable job is also listed with "Move to date" (ticket 87).
test('a head moves a PM job to a date with the keyboard alone', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  const machine = pmCalendarMachine(testInfo.project.name);
  const target = workingDayAfter(nextWorkingDay());
  await stubFigures(page, figuresFor(pmCalendarTaskMachine(testInfo.project.name)));
  await signIn(page, 'head');
  await page.goto('/analytics/pm');
  await expect(page.getByRole('heading', { name: 'PM calendar', exact: true })).toBeVisible();
  const open = page.getByRole('button', { name: `Move to date, ${machine.code}` });
  await open.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const field = dialog.getByLabel('New date');
  for (let tab = 0; tab < 3; tab += 1) {
    if (await field.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(field).toBeFocused();
  await typeDay(page, target);
  const saved = page.waitForResponse(
    (reply) =>
      reply.request().method() === 'POST' &&
      new URL(reply.url()).pathname === '/api/v1/pm/reschedule' &&
      reply.status() === 200,
  );
  await page.keyboard.press('Enter');
  const request = (await saved).request().postDataJSON() as Record<string, unknown>;
  expect(request).toMatchObject({ machineId: machine.id, scheduledOn: target });
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: `moved to ${shownDay(target)}` }),
  ).toBeVisible();
  await expect(open).toBeFocused();
  await expect(cellOf(page, target).getByText(machine.code, { exact: true })).toBeVisible();
});

test('an operator is refused the PM calendar and the move', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  const machine = pmCalendarMachine(testInfo.project.name);
  await signIn(page, 'op');
  await page.goto('/analytics/pm');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'PM calendar', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-date]')).toHaveCount(0);

  const token = await apiLogin('op');
  const refused = await apiFetch('/api/v1/pm/reschedule', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': `op-${Date.now()}`,
    },
    body: JSON.stringify({ machineId: machine.id, scheduledOn: nextWorkingDay() }),
  });
  expect(refused.status).toBe(403);
});
