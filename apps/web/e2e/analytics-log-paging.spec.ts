import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { signIn } from './fixtures.js';

/**
 * Ticket 87 and 91: the Breakdown Log opens on one page of rows. The figures reply is stubbed with the plant's
 * 1,343-row log; the screen must never paint more than ten rows at once (UX-RULES 14), keep the engine's row numbers
 * and page on from the newest. The expectations are written out here, not taken from the product's own formatters.
 */

const TOTAL = 1343;
const PAGE = 10;
const HEADER = [
  '',
  'Sr No',
  'Ticket No.',
  'Date',
  'Shift',
  'Machine',
  'Problem',
  'Done By',
  'Downtime (Hrs)',
  'Code',
];

/** The log newest first: Sr No 1343 at the head, a dash for every seventh row (no downtime recorded). */
function logRows(): string[][] {
  return Array.from({ length: TOTAL }, (_, at) => {
    const srNo = TOTAL - at;
    return [
      '👁',
      String(srNo),
      `BD-${String(srNo).padStart(4, '0')}`,
      '07-11-2026',
      '2',
      `VC-${(srNo % 40) + 1}`,
      `Problem ${srNo}`,
      'Person 41',
      srNo % 7 === 0 ? '—' : `${srNo % 5}.${(srNo % 9) + 1}`,
      'ATC',
    ];
  });
}

function reply(): FiguresReply {
  const rows = logRows();
  return {
    asOf: '2026-11-11',
    profile: {} as FiguresReply['profile'],
    excludedMachines: 0,
    rows: { machines: 125, moves: 0, tickets: TOTAL, tasks: 0, reports: 0, people: 4 },
    figures: [
      {
        key: 'breakdown-log',
        screen: 'breakdown-log',
        owner: 40,
        status: 'ready',
        value: {
          screen: 'breakdown-log',
          asOf: '2026-11-11',
          pages: [
            {
              page: 'breakdowns',
              title: 'Breakdown Log',
              kpis: [],
              tables: [
                {
                  title: '',
                  header: HEADER,
                  rows,
                  // The engine prints each row's own ticket beside it, in row order.
                  rowTicketIds: rows.map((_, at) => `fake-${at}`),
                  rowCount: TOTAL,
                  truncated: true,
                },
              ],
              charts: [],
            },
          ],
          // Beside the page, as the engine sends it: one entry per row in row order, and the plant's code list.
          extra: {
            rows: rows.map((row) => ({
              supportedBy: '',
              type: '',
              severity: Number(row[8]) > 4 ? 'long' : Number(row[8]) > 1 ? 'watch' : '',
            })),
            codes: [],
          },
        },
        // The engine sorts a figure's drill ids (as text), so by position they are not the rows' own tickets.
        drill: { type: 'ticket', ids: rows.map((_, at) => `fake-${at}`).sort() },
      },
    ],
  };
}

const log = (page: Page) => page.getByRole('region', { name: 'Breakdown log', exact: true });

test('the Breakdown Log opens on 10 of its 1,343 rows and pages on from the newest', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // The most table rows that were ever on the page at once, from the first paint on.
  await page.addInitScript(() => {
    const seen = window as unknown as { mostRows: number };
    seen.mostRows = 0;
    new MutationObserver(() => {
      seen.mostRows = Math.max(seen.mostRows, document.querySelectorAll('tbody tr').length);
    }).observe(document, { childList: true, subtree: true });
  });
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: reply() }));
  await signIn(page, 'head');
  await page.goto('/analytics/breakdowns');

  const rows = log(page).locator('tbody tr');
  await expect(rows).toHaveCount(PAGE);
  await expect(page.getByText(/^1,343 rows · Records to 11-Nov-2026$/)).toBeVisible();
  await expect(log(page).getByText('1–10 of 1,343', { exact: true })).toBeVisible();
  await expect(rows.first().getByRole('cell').first()).toHaveText('1343');
  await expect(rows.last().getByRole('cell').first()).toHaveText('1334');
  await expect(log(page).getByRole('cell', { name: '—', exact: true }).first()).toBeVisible();

  await log(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(log(page).getByText('11–20 of 1,343', { exact: true })).toBeVisible();
  await expect(rows).toHaveCount(PAGE);
  await expect(rows.first().getByRole('cell').first()).toHaveText('1333');

  // A filter narrows the pages, and the count of the whole log stays in sight.
  await log(page).getByLabel('Machine', { exact: true }).selectOption('VC-2');
  await expect(page.getByText(/^1,343 rows · Records to 11-Nov-2026$/)).toBeVisible();
  await expect(page.getByText(/The log holds 1,343 entries/)).toBeVisible();
  await expect(log(page).getByText('1–10 of 34', { exact: true })).toBeVisible();
  await expect(rows).toHaveCount(PAGE);

  expect(await page.evaluate(() => (window as unknown as { mostRows: number }).mostRows)).toBe(
    PAGE,
  );
});

test('a sorted log keeps each ticket link right, puts dashes last and keeps its sort through a filter', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: reply() }));
  await signIn(page, 'head');
  await page.goto('/analytics/breakdowns');

  const rows = log(page).locator('tbody tr');
  const downtime = log(page).getByRole('columnheader', { name: 'Downtime (hrs)' });
  const sortButton = downtime.getByRole('button');
  await sortButton.click();
  // The v2 kit's tables sort the biggest first, then the smallest (v1 went smallest first); the dash is last either way.
  await expect(downtime).toHaveAttribute('aria-sort', 'descending');
  await sortButton.click();
  await expect(downtime).toHaveAttribute('aria-sort', 'ascending');
  // The dash means no downtime recorded: it sorts last whichever way, so none is on the first page.
  await expect(rows).toHaveCount(PAGE);
  await expect(rows.locator('td:nth-child(8)', { hasText: '—' })).toHaveCount(0);

  // On page 2 of the sorted log each ticket link still opens the ticket of its own row (id is 1343 minus the Sr No).
  await log(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(log(page).getByText('11–20 of 1,343', { exact: true })).toBeVisible();
  const srNo = Number(await rows.first().getByRole('cell').first().innerText());
  await expect(rows.first().getByRole('link')).toHaveAttribute(
    'href',
    `/desk/fake-${TOTAL - srNo}`,
  );
  await expect(rows.first().getByRole('link')).toHaveAttribute(
    'aria-label',
    `BD-${String(srNo).padStart(4, '0')}: Open the ticket for Sr No ${srNo}`,
  );

  // A filter keeps the sort, and the dashes of the narrowed log are on its last page.
  await log(page).getByLabel('Machine', { exact: true }).selectOption('VC-2');
  await expect(downtime).toHaveAttribute('aria-sort', 'ascending');
  await expect(log(page).getByText('1–10 of 34', { exact: true })).toBeVisible();
  await expect(rows.first().locator('td:nth-child(8)')).not.toHaveText('—');
  for (let next = 0; next < 3; next += 1)
    await log(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(log(page).getByText('31–34 of 34', { exact: true })).toBeVisible();
  await expect(rows.last().locator('td:nth-child(8)')).toHaveText('—');
});
