import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { commandViaApi, getJson } from './fixtures-actions.js';
import { MACHINES, apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';

/**
 * 43e: the Compare, Team Focus, Money Matters and Fix Finder screens. A head opens each screen on the real
 * stack, reads the frozen 11 November key (the figures reply is stubbed on the established seam, so the
 * journey proves the screens, not the engines), sorts the Fix Finder table, sees the 31 Team Focus actions
 * and opens a drill whose rows are real machines and a real ticket.
 */

type Figure = FiguresReply['figures'][number];

interface KeyTable {
  title: string;
  header: string[];
  rows: string[][];
  rowCount: number;
}

interface KeyPage {
  page: string;
  title: string;
  kpis: { label: string; value: string; sub: string }[];
  tables: KeyTable[];
}

interface FocusAction {
  key: string;
  lane: string;
  machine?: string;
  title: string;
  stake: number;
  status: string;
  owner: string;
  note: string;
}

interface KeyFile {
  pages: KeyPage[];
  extra?: FocusAction[];
}

/** The frozen keys, read as data; never a hand-copied table. */
function keyOf(name: string): KeyFile {
  return JSON.parse(
    readFileSync(new URL(`../../../fixtures/answer-key/${name}.json`, import.meta.url), 'utf8'),
  ) as KeyFile;
}

const COMPARE = keyOf('compare');
const TEAM = keyOf('team-focus');
const MONEY = keyOf('money-matters');
const FIX = keyOf('fix-finder');
const CMP = COMPARE.pages[0]!;
const TF = TEAM.pages[0]!;
const MM = MONEY.pages[0]!;
const FF = FIX.pages[0]!;

/** Neutral screen constants, so CI's secret scanner never reads a figure lookup as an API key. */
const SCREEN_COMPARE = 'compare';
const SCREEN_TEAM = 'team-focus';
const SCREEN_MONEY = 'money-matters';
const SCREEN_FIX = 'fix-finder';
const AS_OF = '2026-11-11';
const MACHINE_IDS = MACHINES.map((machine) => machine.id);

let ticket: { id: string; ref: string };

test.beforeAll(async () => {
  const token = await apiLogin('head');
  const me = await getJson<{ user: { actingPersonId: string } }>(token, '/api/v1/auth/me');
  const raised = await raiseTicketViaApi(token, null, 'Compare screens: spindle overload');
  // Cancelled so it sits in no desk list; the drill still opens its page.
  await commandViaApi(token, raised.id, 'cancel', {
    personId: me.user.actingPersonId,
    reason: '43e screens spec',
  });
  ticket = raised;
});

function figureOf(
  key: string,
  value: unknown,
  drill: { type: 'machine' | 'ticket'; ids: string[] },
): Figure {
  return { key, screen: key, owner: 43, status: 'ready', value, drill };
}

async function stubFigures(page: Page): Promise<void> {
  const reply: FiguresReply = {
    asOf: AS_OF,
    profile: {} as FiguresReply['profile'],
    rows: { machines: MACHINES.length, moves: 0, tickets: 1, tasks: 0, reports: 0, people: 4 },
    figures: [
      figureOf(SCREEN_COMPARE, COMPARE, { type: 'machine', ids: MACHINE_IDS.slice(0, 2) }),
      figureOf(SCREEN_TEAM, TEAM, { type: 'machine', ids: MACHINE_IDS.slice(0, 2) }),
      figureOf(SCREEN_MONEY, MONEY, { type: 'ticket', ids: [ticket.id] }),
      figureOf(SCREEN_FIX, FIX, { type: 'ticket', ids: [ticket.id] }),
    ],
  };
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: reply }));
}

/** Compare: the key page's six tables and both charts, then its two-machine drill. */
async function openCompare(page: Page): Promise<void> {
  await page.goto(`/analytics/machines?screen=${SCREEN_COMPARE}`);
  const nav = page.getByRole('navigation', { name: 'Machines screens', exact: true });
  await expect(
    nav.getByRole('link', { name: 'Compare machines and health score', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: CMP.title, exact: true })).toBeVisible();
  for (const table of CMP.tables)
    await expect(page.getByRole('heading', { name: table.title, exact: true })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: CMP.tables[0]!.rows[0]![1]!, exact: true }),
  ).toBeVisible();
  const charts = page.getByTestId('chart');
  await expect(charts).toHaveCount(2);
  for (const chart of await charts.all())
    await expect(chart).toHaveAttribute('data-chart-state', 'ready');
  await expect(page.getByText('BD hours by maintenance code', { exact: true })).toBeVisible();
  await expect(page.getByText('BD hours by month', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'See the rows', exact: true }).click();
  await expect(page).toHaveURL(/drill=machine%3A/);
  await expect(
    page.getByRole('heading', { name: 'The rows behind this figure', exact: true }),
  ).toBeVisible();
  const drill = page.locator('section').filter({ hasText: 'The rows behind this figure' });
  const first = MACHINES[0]!;
  await expect(drill.getByRole('link', { name: first.code, exact: true })).toHaveAttribute(
    'href',
    new RegExp(`/analytics/machines/${first.id}$`),
  );
}

/** Team Focus: the three KPIs, the six lane groups and all 31 actions with their defaults. */
async function openTeamFocus(page: Page): Promise<void> {
  await page.goto(`/analytics/today?screen=${SCREEN_TEAM}`);
  const nav = page.getByRole('navigation', { name: 'Today screens', exact: true });
  await expect(nav.getByRole('link', { name: 'Team Focus', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { name: TF.title, exact: true })).toBeVisible();
  for (const kpi of TF.kpis) {
    await expect(page.getByText(kpi.label, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(kpi.value, { exact: true }).first()).toBeVisible();
  }
  expect(TEAM.extra).toHaveLength(31);
  await expect(page.locator('[data-focus-action]')).toHaveCount(31);
  for (const lane of [
    'Before next month',
    'Fix for good',
    'Overhaul or replace?',
    'Why-Why due',
    'Spares to keep ready',
    'Fix the record',
  ])
    await expect(page.getByRole('heading', { name: lane, exact: true })).toBeVisible();
  const first = TEAM.extra![0]!;
  await expect(page.getByText(first.title, { exact: true })).toBeVisible();
  await expect(page.getByText('Status: Not started', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Owner: not assigned', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Note: none yet', { exact: true }).first()).toBeVisible();
}

/** Money Matters: the ten KPIs, both tables and the one chart, then the ticket drill. */
async function openMoney(page: Page): Promise<void> {
  await page.goto('/analytics/cost');
  await expect(page.getByRole('heading', { name: MM.title, exact: true })).toBeVisible();
  for (const kpi of MM.kpis) {
    await expect(page.getByText(kpi.label, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(kpi.value, { exact: true }).first()).toBeVisible();
  }
  for (const table of MM.tables)
    await expect(page.getByRole('heading', { name: table.title, exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '₹ 38.23 lakh', exact: true })).toBeVisible();
  const charts = page.getByTestId('chart');
  await expect(charts).toHaveCount(1);
  await expect(charts.first()).toHaveAttribute('data-chart-state', 'ready');
  await expect(page.getByText('Where the money was lost', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'See the rows', exact: true }).click();
  await expect(page).toHaveURL(/drill=ticket%3A/);
  await expect(
    page.getByRole('heading', { name: 'The rows behind this figure', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: ticket.ref, exact: true })).toBeVisible();
}

/** Fix Finder: its four KPIs, the 15 rows sorted both ways, then the ticket drill. */
async function openFixFinder(page: Page): Promise<void> {
  await page.goto(`/analytics/breakdowns?screen=${SCREEN_FIX}`);
  const nav = page.getByRole('navigation', { name: 'Breakdowns screens', exact: true });
  await expect(nav.getByRole('link', { name: 'Fix Finder', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { name: FF.title, exact: true })).toBeVisible();
  for (const kpi of FF.kpis) {
    await expect(page.getByText(kpi.label, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(kpi.value, { exact: true }).first()).toBeVisible();
  }
  const table = page.getByRole('table', { name: FF.tables[0]!.title, exact: true });
  await expect(table.getByRole('row')).toHaveCount(FF.tables[0]!.rows.length + 1);
  const down = table.getByRole('columnheader', { name: 'Down (hrs)', exact: true });
  await down.getByRole('button').click();
  await expect(down).toHaveAttribute('aria-sort', 'ascending');
  await expect(table.getByRole('row').nth(1).getByRole('cell').nth(2)).toHaveText('TMC-6');
  await down.getByRole('button').press('Enter');
  await expect(down).toHaveAttribute('aria-sort', 'descending');
  await expect(table.getByRole('row').nth(1).getByRole('cell').nth(2)).toHaveText('TC-13');
  await page.getByRole('link', { name: 'See the rows', exact: true }).click();
  await expect(page).toHaveURL(/drill=ticket%3A/);
  await expect(
    page.getByRole('heading', { name: 'The rows behind this figure', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: ticket.ref, exact: true })).toBeVisible();
}

test('a head opens Compare, Team Focus, Money Matters and Fix Finder, sorts and drills one', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');

  await openCompare(page);
  await openTeamFocus(page);
  await openMoney(page);
  await openFixFinder(page);
});
