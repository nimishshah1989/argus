import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { signIn } from './fixtures.js';

/**
 * Ticket 87: the Breakdown Log opens on one page of rows. The figures reply is stubbed with the plant's 1,343-row
 * log; the screen must never paint more than 50 rows at once, keep the engine's row numbers and page on from the
 * newest. The expectations are written out here, not taken from the product's own formatters.
 */

const TOTAL = 1343;
const PAGE = 50;
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
        },
        // The engine sorts a figure's drill ids (as text), so by position they are not the rows' own tickets.
        drill: { type: 'ticket', ids: rows.map((_, at) => `fake-${at}`).sort() },
      },
    ],
  };
}

test('the Breakdown Log opens on 50 of its 1,343 rows and pages on from the newest', async ({
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

  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(PAGE);
  await expect(page.getByText('1,343 rows', { exact: true })).toBeVisible();
  await expect(page.getByText('1 to 50 of 1,343', { exact: true })).toBeVisible();
  await expect(rows.first().getByRole('cell').nth(1)).toHaveText('1343');
  await expect(rows.last().getByRole('cell').nth(1)).toHaveText('1294');
  await expect(page.getByRole('cell', { name: '—', exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('51 to 100 of 1,343', { exact: true })).toBeVisible();
  await expect(rows).toHaveCount(PAGE);
  await expect(rows.first().getByRole('cell').nth(1)).toHaveText('1293');

  // A filter narrows the pages, and the count of the whole log stays in sight.
  await page.getByLabel('Machine', { exact: true }).selectOption('VC-2');
  await expect(page.getByText('1,343 rows', { exact: true })).toBeVisible();
  await expect(page.getByText('34 match these filters', { exact: true })).toBeVisible();
  await expect(rows).toHaveCount(34);

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

  const rows = page.locator('tbody tr');
  const downtime = page.getByRole('columnheader', { name: 'Downtime (Hrs)' });
  const sortButton = downtime.getByRole('button');
  await sortButton.click();
  await expect(downtime).toHaveAttribute('aria-sort', 'ascending');
  await sortButton.click();
  await expect(downtime).toHaveAttribute('aria-sort', 'descending');
  // The dash means no downtime recorded: it sorts last whichever way, so none is on the first page.
  await expect(rows).toHaveCount(PAGE);
  await expect(rows.locator('td:nth-child(9)', { hasText: '—' })).toHaveCount(0);

  // On page 2 of the sorted log each eye link still opens the ticket of its own row (id is 1343 minus the Sr No).
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('51 to 100 of 1,343', { exact: true })).toBeVisible();
  const srNo = Number(await rows.first().getByRole('cell').nth(1).innerText());
  await expect(rows.first().getByRole('link')).toHaveAttribute(
    'href',
    `/desk/fake-${TOTAL - srNo}`,
  );
  await expect(rows.first().getByRole('link')).toHaveAttribute(
    'aria-label',
    `Open the ticket for Sr No ${srNo}`,
  );

  // A filter keeps the sort, and the dashes of the narrowed log are on its last row.
  await page.getByLabel('Machine', { exact: true }).selectOption('VC-2');
  await expect(downtime).toHaveAttribute('aria-sort', 'descending');
  await expect(rows).toHaveCount(34);
  await expect(rows.last().locator('td:nth-child(9)')).toHaveText('—');
  await expect(rows.first().locator('td:nth-child(9)')).not.toHaveText('—');
});
