import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { openShowDetail } from './show-detail.js';
import { MACHINES, signIn } from './fixtures.js';

/**
 * 42e: the A9 Bottleneck Analysis and the Forecast Lab screens (v2, live at their v1 address). A head opens A9, sees
 * all 14 KPIs, the risk table and both charts drawn ready, sorts the risk table by its numeric score, opens the machines
 * behind the page and one machine. Then the Lab: its method table, its month detail, the one line chart with the
 * key's y axis title, and the machines behind it. The figures reply is stubbed with the frozen keys (the face's
 * established seam), so the screen is proved against the key; the drill rows are real machines.
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

/** The frozen 11 November keys, read as data; never a hand-copied table. */
function keyOf(name: string): { pages: KeyPage[] } {
  return JSON.parse(
    readFileSync(new URL(`../../../fixtures/answer-key/${name}.json`, import.meta.url), 'utf8'),
  ) as { pages: KeyPage[] };
}

const A9_KEY = keyOf('a9-bottleneck-forecast');
const FL_KEY = keyOf('forecast-lab');
const A9 = A9_KEY.pages[0]!;
const FL = FL_KEY.pages[0]!;

/** Neutral screen constants, so CI's secret scanner never reads a figure lookup as an API key. */
const SCREEN_A9 = 'a9-bottleneck-forecast';
const SCREEN_LAB = 'forecast-lab';
const AS_OF = '2026-11-11';

const RISK = A9.tables[0]!;
const METHOD = FL.tables[0]!;
const MONTHS = FL.tables[1]!;
const DRILL_IDS = MACHINES.map((machine) => machine.id);

function figureOf(key: string, value: unknown): Figure {
  return {
    key,
    screen: key,
    owner: 42,
    status: 'ready',
    value,
    drill: { type: 'machine', ids: DRILL_IDS },
  };
}

async function stubFigures(page: Page): Promise<void> {
  const reply: FiguresReply = {
    asOf: AS_OF,
    profile: {} as FiguresReply['profile'],
    excludedMachines: 0,
    rows: { machines: 12, moves: 0, tickets: 0, tasks: 0, reports: 6, people: 4 },
    figures: [figureOf(SCREEN_A9, A9_KEY), figureOf(SCREEN_LAB, FL_KEY)],
  };
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: reply }));
}

const range = (rows: number) => new RegExp(`^1–\\d+ of ${rows}$`);

async function firstRiskMachine(page: Page): Promise<string> {
  const table = page.getByRole('region', { name: RISK.title, exact: true });
  return (await table.getByRole('row').nth(1).getByRole('cell').nth(1).innerText()).trim();
}

const tabs = (page: Page) =>
  page.getByRole('group', { name: 'Screens in Reliability & forecast', exact: true });

/** A9: the page, its 14 KPIs, the risk table and both charts drawn by the one chart kit. */
async function openA9(page: Page): Promise<void> {
  await page.goto(`/analytics/forecast-scorecard?screen=${SCREEN_A9}`);
  await expect(
    tabs(page).getByRole('button', { name: 'Bottleneck and forecast', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1, name: A9.title })).toBeVisible();
  expect(A9.kpis).toHaveLength(14);
  await openShowDetail(
    page,
    page.getByRole('region', { name: A9.kpis[0]!.label, exact: true }).first(),
  );
  // Each figure is a region named by its label; the same words also sit in the answer's Why list and in table filters.
  for (const kpi of A9.kpis) {
    const tile = page.getByRole('region', { name: kpi.label, exact: true }).first();
    await expect(tile).toBeVisible();
    await expect(tile.getByText(kpi.value, { exact: true })).toBeVisible();
    if (kpi.sub) await expect(tile.getByText(kpi.sub, { exact: true })).toBeVisible();
  }
  const risk = page.getByRole('region', { name: RISK.title, exact: true });
  await expect(risk).toBeVisible();
  await expect(risk.getByText(range(RISK.rows.length))).toBeVisible();
  for (const heading of RISK.header)
    await expect(risk.getByRole('columnheader', { name: heading, exact: true })).toBeVisible();
  await expect(
    risk.getByRole('button', { name: RISK.rows[0]![1]!, exact: true }).first(),
  ).toBeVisible();
  const charts = page.locator('[data-chart-state]');
  await expect(charts).toHaveCount(2);
  for (const chart of await charts.all())
    await expect(chart).toHaveAttribute('data-chart-state', 'ready');
  await expect(
    page.getByText('Risk map — every machine, grouped by kind', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Expected downtime, machine by machine', { exact: true }),
  ).toBeVisible();
}

/** One numeric column, both ways: the click sorts largest first, the keyboard press reverses it. */
async function sortRisk(page: Page): Promise<void> {
  const table = page.getByRole('region', { name: RISK.title, exact: true });
  const ascending = [...RISK.rows].sort((left, right) => Number(left[10]) - Number(right[10]));
  const header = table.getByRole('columnheader', { name: 'Score', exact: true });
  await expect(header).not.toHaveAttribute('aria-sort', /ascending|descending/);
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  expect(await firstRiskMachine(page)).toBe(RISK.rows[0]![1]);
  await header.getByRole('button').press('Enter');
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  expect(await firstRiskMachine(page)).toBe(ascending[0]![1]);
}

/** The page action opens every machine the figure counted, in the drawer; a machine in it opens on top and Back returns. */
async function openMachineDrill(page: Page, figure: string, name: RegExp): Promise<void> {
  await page.getByRole('button', { name }).click();
  await expect(page).toHaveURL(new RegExp(`[?&]drawer=figure:${figure}$`));
  const drawer = page.locator('aside.v2-drawer');
  await expect(drawer.getByText(new RegExp(`of ${DRILL_IDS.length}$`))).toBeVisible();
  const first = MACHINES[0]!;
  await drawer.getByRole('button', { name: first.code, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`[?&]drawer=machine:${first.code}`));
}

/** The Lab: its method table, its month detail and the one line chart titled with the key's y axis. */
async function openLab(page: Page): Promise<void> {
  await page.goto(`/analytics/forecast-scorecard?screen=${SCREEN_LAB}`);
  await expect(
    tabs(page).getByRole('button', { name: 'Forecast Lab', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1, name: FL.title })).toBeVisible();
  const method = page.getByRole('region', { name: METHOD.title, exact: true });
  await expect(method).toBeVisible();
  // Under 10 rows a table has no pager (ADR 0036 R13): every row of the key is drawn, under its one header row.
  await expect(method.getByRole('row')).toHaveCount(METHOD.rows.length + 1);
  for (const heading of METHOD.header.filter((label) => label !== ''))
    await expect(method.getByRole('columnheader', { name: heading, exact: true })).toBeVisible();
  await expect(method.getByText('1.85', { exact: true }).first()).toBeVisible();
  const months = page.getByRole('region', { name: MONTHS.title, exact: true });
  await expect(months).toBeVisible();
  await expect(months.getByRole('row')).toHaveCount(MONTHS.rows.length + 1);
  await expect(months.getByRole('cell', { name: '194.4', exact: true })).toBeVisible();
  const charts = page.locator('[data-chart-state]');
  await expect(charts).toHaveCount(1);
  await expect(charts.first()).toHaveAttribute('data-chart-state', 'ready');
  await expect(page.getByText('Breakdown hours in the month', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Plant downtime: forecast against actual, month by month', { exact: true }),
  ).toBeVisible();
}

test('a head opens A9 and the Forecast Lab, sorts the risk table, reads both charts ready and drills machines', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');

  await openA9(page);
  await sortRisk(page);
  await openMachineDrill(page, SCREEN_A9, /Show the rows behind Bottleneck and forecast/);

  await openLab(page);
  await openMachineDrill(page, SCREEN_LAB, /Show the rows behind Forecast Lab/);
});

test('an old v1 address opens the v2 screen: an unknown screen opens A9, and a ?drill= link opens its rows', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');

  await page.goto('/analytics/forecast-scorecard?screen=no-such-screen');
  await expect(page.getByRole('heading', { level: 1, name: A9.title })).toBeVisible();

  const link = encodeURIComponent(`machine:${DRILL_IDS.join(',')}`);
  await page.goto(`/analytics/forecast-scorecard?screen=${SCREEN_LAB}&drill=${link}`);
  await expect(page).toHaveURL(new RegExp(`[?&]drawer=figure:${SCREEN_LAB}$`));
  await expect(page).not.toHaveURL(/drill=/);
});
