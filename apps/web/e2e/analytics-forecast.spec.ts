import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { MACHINES, signIn } from './fixtures.js';

/**
 * 42e: the A9 Bottleneck Analysis and the Forecast Lab screens. A head opens A9, sees all 14 KPIs, the
 * risk table and both charts drawn ready, sorts the risk table by its numeric score, opens the machine
 * drill and one machine row. Then the Lab: its method table, its month detail, the one line chart with the
 * key's y axis title, and the machine drill behind it. The figures reply is stubbed with the frozen keys
 * (the face's established seam), so the screen is proved against the key; the drill rows are real machines.
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
    rows: { machines: 12, moves: 0, tickets: 0, tasks: 0, reports: 6, people: 4 },
    figures: [figureOf(SCREEN_A9, A9_KEY), figureOf(SCREEN_LAB, FL_KEY)],
  };
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: reply }));
}

async function firstRiskMachine(page: Page): Promise<string> {
  const table = page.getByRole('table', { name: RISK.title, exact: true });
  return (await table.getByRole('row').nth(1).getByRole('cell').nth(1).innerText()).trim();
}

/** A9: the key page, its 14 KPIs, the risk table and both charts drawn by the one chart kit. */
async function openA9(page: Page): Promise<void> {
  await page.goto(`/analytics/forecast-scorecard?screen=${SCREEN_A9}`);
  const nav = page.getByRole('navigation', { name: 'Forecast screens', exact: true });
  await expect(
    nav.getByRole('link', { name: 'A9 bottleneck and forecast', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: A9.title, exact: true })).toBeVisible();
  expect(A9.kpis).toHaveLength(14);
  for (const kpi of A9.kpis) {
    await expect(page.getByText(kpi.label, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(kpi.value, { exact: true }).first()).toBeVisible();
  }
  const risk = page.getByRole('table', { name: RISK.title, exact: true });
  await expect(risk).toBeVisible();
  await expect(risk.getByRole('row')).toHaveCount(RISK.rows.length + 1);
  for (const heading of RISK.header)
    await expect(risk.getByRole('columnheader', { name: heading, exact: true })).toBeVisible();
  await expect(
    risk.getByRole('cell', { name: RISK.rows[0]![1]!, exact: true }).first(),
  ).toBeVisible();
  const charts = page.getByTestId('chart');
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

/** One numeric column, both ways: the click sorts ascending, the keyboard press brings the key's order back. */
async function sortRisk(page: Page): Promise<void> {
  const table = page.getByRole('table', { name: RISK.title, exact: true });
  const ascending = [...RISK.rows].sort((left, right) => Number(left[10]) - Number(right[10]));
  const header = table.getByRole('columnheader', { name: 'Score', exact: true });
  await expect(header).toHaveAttribute('aria-sort', 'none');
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  expect(await firstRiskMachine(page)).toBe(ascending[0]![1]);
  await header.getByRole('button').press('Enter');
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  expect(await firstRiskMachine(page)).toBe(RISK.rows[0]![1]);
}

/** The figure's own machine drill: every real machine, one row opening that machine's page. */
async function openMachineDrill(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'See the rows', exact: true }).click();
  await expect(page).toHaveURL(/drill=machine%3A/);
  await expect(
    page.getByRole('heading', { name: 'The rows behind this figure', exact: true }),
  ).toBeVisible();
  const section = page.locator('section').filter({ hasText: 'The rows behind this figure' });
  const table = section.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(DRILL_IDS.length + 1);
  const first = MACHINES[0]!;
  const link = table.getByRole('link', { name: first.code, exact: true });
  await expect(link).toHaveAttribute('href', new RegExp(`/analytics/machines/${first.id}$`));
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/analytics/machines/${first.id}$`));
}

/** The Lab: its method table, its month detail and the one line chart titled with the key's y axis. */
async function openLab(page: Page): Promise<void> {
  await page.goto(`/analytics/forecast-scorecard?screen=${SCREEN_LAB}`);
  const nav = page.getByRole('navigation', { name: 'Forecast screens', exact: true });
  await expect(nav.getByRole('link', { name: 'Forecast Lab', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { name: FL.title, exact: true })).toBeVisible();
  const method = page.getByRole('table', { name: METHOD.title, exact: true });
  await expect(method).toBeVisible();
  await expect(method.getByRole('row')).toHaveCount(METHOD.rows.length + 1);
  for (const heading of METHOD.header)
    await expect(method.getByRole('columnheader', { name: heading, exact: true })).toBeVisible();
  await expect(method.getByText('1.85', { exact: true }).first()).toBeVisible();
  const months = page.getByRole('table', { name: MONTHS.title, exact: true });
  await expect(months).toBeVisible();
  await expect(months.getByRole('row')).toHaveCount(MONTHS.rows.length + 1);
  await expect(months.getByRole('cell', { name: '194.4', exact: true })).toBeVisible();
  const charts = page.getByTestId('chart');
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
  await openMachineDrill(page);

  await openLab(page);
  await page.getByRole('link', { name: 'See the rows', exact: true }).click();
  await expect(page).toHaveURL(/drill=machine%3A/);
  await expect(
    page.getByRole('heading', { name: 'The rows behind this figure', exact: true }),
  ).toBeVisible();
  const drill = page.locator('section').filter({ hasText: 'The rows behind this figure' });
  await expect(drill.getByRole('table').getByRole('row')).toHaveCount(DRILL_IDS.length + 1);
});
