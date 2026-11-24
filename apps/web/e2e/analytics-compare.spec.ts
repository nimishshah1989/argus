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

const TEAM = keyOf('team-focus');
const MONEY = keyOf('money-matters');
const FIX = keyOf('fix-finder');
const MM = MONEY.pages[0]!;
const FF = FIX.pages[0]!;

/** Neutral screen constants, so CI's secret scanner never reads a figure lookup as an API key. */
const SCREEN_TEAM = 'team-focus';
const TEAM_PERIOD = '2026-12';
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
    excludedMachines: 0,
    rows: { machines: MACHINES.length, moves: 0, tickets: 1, tasks: 0, reports: 0, people: 4 },
    figures: [
      // The frozen key predates `period` (ADR 0020); the live engine prints it, so the stub does too.
      figureOf(
        SCREEN_TEAM,
        { ...TEAM, period: TEAM_PERIOD },
        {
          type: 'machine',
          ids: MACHINE_IDS.slice(0, 2),
        },
      ),
      figureOf(SCREEN_MONEY, MONEY, { type: 'ticket', ids: [ticket.id] }),
      figureOf(SCREEN_FIX, FIX, { type: 'ticket', ids: [ticket.id] }),
    ],
  };
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: reply }));
}

/**
 * Team Focus (v2, TF-3, ADR 0020): the four key figures, all 31 actions in the table, every one waiting for an owner
 * (no note is saved yet), no money; taking the biggest saves the head as its owner through the notes endpoint.
 */
async function openTeamFocus(page: Page): Promise<void> {
  await page.goto(`/analytics/today?screen=${SCREEN_TEAM}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Team Focus' })).toBeVisible();
  for (const label of ['Open actions', 'At stake a month', 'No owner yet', 'Done'])
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  expect(TEAM.extra).toHaveLength(31);
  const table = page.getByRole('region', { name: 'Every action this month', exact: true });
  await expect(table.getByText('1–10 of 31')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Needs an owner', exact: true })).toBeVisible();
  await expect(page.getByText('₹')).toHaveCount(0);
  // The biggest stake first; a tie keeps the engine's order.
  const biggest = TEAM.extra!.map((action, at) => ({ ...action, at })).sort(
    (a, b) => b.stake - a.stake || a.at - b.at,
  )[0]!;
  await expect(page.getByText(biggest.title, { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'I’ll take it', exact: true }).first().click();
  const token = await apiLogin('head');
  await expect
    .poll(async () => {
      const read = await getJson<{ notes: Record<string, { owner: string }> }>(
        token,
        `/api/v1/analytics/team-focus/notes?period=${TEAM_PERIOD}`,
      );
      return read.notes[biggest.key]?.owner ?? '';
    })
    .not.toBe('');
}

/** Money Matters (the v2 screen at its v1 address, ticket 679): the ten KPIs, both tables, the one chart, then the ticket drill. */
async function openMoney(page: Page): Promise<void> {
  await page.goto('/analytics/cost');
  await expect(page.getByRole('heading', { level: 1, name: MM.title })).toBeVisible();
  for (const kpi of MM.kpis) {
    await expect(page.getByText(kpi.label, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(kpi.value, { exact: true }).first()).toBeVisible();
  }
  for (const table of MM.tables)
    await expect(page.getByRole('region', { name: table.title, exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '₹ 38.23 lakh', exact: true })).toBeVisible();
  const charts = page.getByTestId('chart');
  await expect(charts).toHaveCount(1);
  await expect(charts.first()).toHaveAttribute('data-chart-state', 'ready');
  await page.getByRole('button', { name: /Show the rows behind Money Matters/ }).click();
  await expect(page).toHaveURL(/[?&]drawer=figure:money-matters$/);
  await expect(page.getByRole('link', { name: ticket.ref, exact: true })).toBeVisible();
}

/** Fix Finder (the v2 screen at its v1 address): its four figures, the rows sorted both ways, then the ticket drill. */
async function openFixFinder(page: Page): Promise<void> {
  await page.goto(`/analytics/breakdowns?screen=${SCREEN_FIX}`);
  const tabs = page.getByRole('group', { name: 'Breakdowns screens', exact: true });
  await expect(tabs.getByRole('button', { name: 'Fix Finder', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('heading', { level: 1, name: 'Fix Finder' })).toBeVisible();
  for (const kpi of FF.kpis) {
    await expect(page.getByText(kpi.label, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(kpi.value, { exact: true }).first()).toBeVisible();
  }
  const table = page.getByRole('region', { name: FF.tables[0]!.title, exact: true });
  await expect(table.getByText(`1–10 of ${FF.tables[0]!.rows.length}`)).toBeVisible();
  const down = table.getByRole('columnheader', { name: /Down \(hrs\)/ });
  await down.getByRole('button').click();
  await expect(down).toHaveAttribute('aria-sort', 'descending');
  await expect(table.getByRole('row').nth(1).getByRole('button').first()).toHaveText('TC-13');
  await down.getByRole('button').click();
  await expect(down).toHaveAttribute('aria-sort', 'ascending');
  await expect(table.getByRole('row').nth(1).getByRole('button').first()).toHaveText('TMC-6');
  await page.getByRole('button', { name: /Show the rows behind Fix Finder/ }).click();
  await expect(page).toHaveURL(/[?&]drawer=figure:fix-finder$/);
  await expect(page.getByRole('link', { name: ticket.ref, exact: true })).toBeVisible();
}

test('a head opens Team Focus, Money Matters and Fix Finder, sorts and drills one', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');

  await openTeamFocus(page);
  await openMoney(page);
  await openFixFinder(page);
});
