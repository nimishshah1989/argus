import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { signIn } from './fixtures.js';

/**
 * 45e: the Reports group. A head opens `/analytics/reports`, sees the monthly report whole with its October 2026
 * period line, reads the key's first machine row and both charts, then switches to the annual report, sees the
 * 2026-to-11-November period line and reads its Months-in-top-5 row, and follows the PDF link. The figures reply is
 * stubbed with the two frozen keys (the face's established seam); the PDF route is 45d's, stubbed in-test so the
 * link is proved without the download endpoints on this branch.
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
  kpis: unknown[];
  tables: KeyTable[];
}

interface KeyFile {
  screen: string;
  asOf: string;
  pages: KeyPage[];
}

const MONTHLY = keyOf('monthly-report');
const ANNUAL = keyOf('annual-report');
const MONTHLY_PAGE = MONTHLY.pages[0]!;
const ANNUAL_PAGE = ANNUAL.pages[0]!;

/** The monthly key's machine ranking (the first of the four "Where the time went" tables). */
const MACHINE_RANK = MONTHLY_PAGE.tables[0]!;
/** The annual key's "Where the downtime comes from" table, whose last column is Months in top 5. */
const TOP_MACHINES = ANNUAL_PAGE.tables[2]!;
const MONTHS_IN_TOP = TOP_MACHINES.header.indexOf('Months in top 5');

const COMMENTARY = 'Management commentary and actions';

function keyOf(name: string): KeyFile {
  return JSON.parse(
    readFileSync(new URL(`../../../fixtures/answer-key/${name}.json`, import.meta.url), 'utf8'),
  ) as KeyFile;
}

function figureOf(key: KeyFile): Figure {
  return {
    key: key.screen,
    screen: key.screen,
    owner: 45,
    status: 'ready',
    value: key,
    drill: { type: 'ticket', ids: [] },
  };
}

async function stubFigures(page: Page): Promise<void> {
  const reply: FiguresReply = {
    asOf: MONTHLY.asOf,
    profile: {} as FiguresReply['profile'],
    excludedMachines: 0,
    rows: { machines: 125, moves: 0, tickets: 0, tasks: 0, reports: 0, people: 0 },
    figures: [figureOf(MONTHLY), figureOf(ANNUAL)],
  };
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: reply }));
}

/** The PDF endpoints are 45d's; the face only needs a PDF response so the link can be followed. */
async function stubPdf(page: Page): Promise<void> {
  await page.route('**/api/v1/reports/*.pdf', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="report.pdf"',
      },
      body: '%PDF-1.4\n',
    }),
  );
}

/** Both report charts are drawn ready by the one chart kit. */
async function expectCharts(page: Page): Promise<void> {
  const charts = page.getByTestId('chart');
  await expect(charts).toHaveCount(2);
  for (const chart of await charts.all())
    await expect(chart).toHaveAttribute('data-chart-state', 'ready');
}

test('a head opens the reports, switches to the annual report, reads both keys and follows the PDF link', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await stubPdf(page);
  await signIn(page, 'head');
  await page.goto('/analytics/reports');

  // The monthly report opens by default: its switch, period line, title, tables and charts.
  const nav = page.getByRole('navigation', { name: 'Screens in Reports', exact: true });
  await expect(nav.getByRole('link', { name: 'Monthly report', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByText('October 2026', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: MONTHLY_PAGE.title, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: COMMENTARY, exact: true })).toBeVisible();
  await expectCharts(page);

  const pdf = page.getByRole('link', { name: 'Download PDF', exact: true });
  await expect(pdf).toHaveAttribute('href', '/api/v1/reports/monthly.pdf');
  await expect(
    page.getByRole('link', { name: 'Export the whole data set (Excel)', exact: true }),
  ).toHaveAttribute('href', '/api/v1/reports/workbook.xlsx');

  // The monthly key's first machine row, cell for cell.
  const machines = page.getByRole('table', { name: MACHINE_RANK.title, exact: true }).first();
  const firstMachine = machines.getByRole('row').nth(1);
  await expect(firstMachine.getByRole('cell')).toHaveCount(MACHINE_RANK.header.length);
  for (const [index, cell] of MACHINE_RANK.rows[0]!.entries())
    await expect(firstMachine.getByRole('cell').nth(index)).toHaveText(cell);

  // Switch to the annual report: its period line, title, commentary caption and charts.
  await nav.getByRole('link', { name: 'Annual report', exact: true }).click();
  await expect(page).toHaveURL(/screen=annual-report/);
  await expect(nav.getByRole('link', { name: 'Annual report', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByText('2026 to 11 November', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: ANNUAL_PAGE.title, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: COMMENTARY, exact: true })).toBeVisible();
  await expectCharts(page);
  await expect(pdf).toHaveAttribute('href', '/api/v1/reports/annual.pdf');

  // The annual key's Months-in-top-5 row: its machine and its count.
  const top = page.getByRole('table', { name: TOP_MACHINES.title, exact: true });
  const firstTop = top.getByRole('row').nth(1);
  await expect(firstTop.getByRole('cell').nth(1)).toHaveText(TOP_MACHINES.rows[0]![1]!);
  await expect(firstTop.getByRole('cell').nth(MONTHS_IN_TOP)).toHaveText(
    TOP_MACHINES.rows[0]![MONTHS_IN_TOP]!,
  );

  // Follow the PDF link: the stubbed response arrives as a real PDF download.
  const download = page.waitForEvent('download');
  await pdf.click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('report.pdf');
  const path = await file.path();
  expect(path).toBeTruthy();
  expect((await readFile(path as string)).subarray(0, 5).toString()).toBe('%PDF-');
});
