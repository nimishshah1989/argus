import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { MACHINES, signIn } from './fixtures.js';

/**
 * 67c: one machine's reliability block. A head opens a machine with its own Weibull fit, reads the shape, the
 * scale, the mean, the sample, the Kaplan-Meier quartiles and the trend word, follows the fit's drill to the
 * breakdown rows, and reads the critical spares with their "15 parts, 5 shown" line. A machine with too little
 * history says "Not enough history" with both counts; a machine with no spare shows no link; a machine the
 * figure does not hold says "Not available"; an uncomputed figure says so. The figures reply is stubbed (the
 * established seam), so the journey proves the screen, not the engine; the drill reply is stubbed with one row.
 */

const FULL = MACHINES[0];
const PARTIAL = MACHINES[1];
const SPARELESS = MACHINES[2];

if (!FULL || !PARTIAL || !SPARELESS)
  throw new Error('the fixtures no longer hold the three machines this spec opens');

const FULL_ID = FULL.id;
const PARTIAL_ID = PARTIAL.id;
const SPARELESS_ID = SPARELESS.id;

/** A machine the reliability figure does not hold (not in production data): its blocks say "Not available". */
const CONVENTIONAL = '10000000-0000-4000-8000-00000000c0de';

const AS_OF = '2026-11-11';

/** The fit's tickets: enough to drill, far below the 200-id cap. */
const FIT_TICKETS = [
  '10000000-0000-4000-8000-0000000000a1',
  '10000000-0000-4000-8000-0000000000a2',
  '10000000-0000-4000-8000-0000000000a3',
  '10000000-0000-4000-8000-0000000000a4',
];
const SPARE_TICKETS = ['10000000-0000-4000-8000-0000000000b1'];

/** HMC-2's own fit, as packet 67a computes it and packet 67b stores it. */
const FULL_FIT = {
  status: 'fitted',
  basis: 'machine',
  category: 'Horizontal Machining Center',
  ownEvents: 43,
  shape: 0.879204344,
  scale: 107.012214493,
  meanHours: 114.085658462,
  events: 43,
  completeIntervals: 42,
  censoredHours: 70,
  quartiles: { q25: 18.75, median: 51.370967742, q75: 135.483870968 },
  trend: { beta: 1.73491878, n: 43, label: 'worsening' },
};

/** WJ-01's shape of list: five shown of fifteen parts, so the "N parts, M shown" line prints. */
const SHOWN_PARTS = [
  ['Seal 20422243', 2, 13.2833, '2026-10-13'],
  ['10110393 and 20422243', 2, 6.0833, '2026-07-16'],
  ['80086622 Seal', 1, 9, '2026-10-13'],
  ['Seal 50056849', 1, 4.2833, '2026-08-01'],
  ['1" transperant pipe', 1, 4.25, '2026-05-01'],
] as const;

const FIGURES: FiguresReply = {
  asOf: AS_OF,
  profile: {} as FiguresReply['profile'],
  excludedMachines: 0,
  rows: { machines: 4, moves: 0, tickets: 0, tasks: 0, reports: 0, people: 0 },
  figures: [
    {
      key: 'machine-page',
      screen: 'machine-page',
      owner: 39,
      status: 'ready',
      value: {
        byMachine: {
          [FULL_ID]: {
            machine: {
              code: FULL.code,
              category: 'Horizontal Machining Center',
              cell: FULL.cell,
              purchasedOn: '2006-10-01',
            },
            breakdowns: { count: 50, hours: 190.5, mttr: 3.81, lastOn: '2026-11-07' },
            pm: { visits: 4, hours: 6 },
            completeness: { recorded: 10, of: 10, missing: [] },
          },
          [PARTIAL_ID]: {
            machine: { code: PARTIAL.code, category: 'Turning Center', cell: PARTIAL.cell },
            breakdowns: { count: 4, hours: 8.5, mttr: 2.13, lastOn: '2026-09-22' },
            pm: { visits: 1, hours: 2 },
            completeness: { recorded: 10, of: 10, missing: [] },
          },
          [SPARELESS_ID]: {
            machine: {
              code: SPARELESS.code,
              category: 'Vertical Machining Center',
              cell: SPARELESS.cell,
            },
            breakdowns: { count: 0 },
            pm: { visits: 0, hours: 0 },
            completeness: { recorded: 10, of: 10, missing: [] },
          },
          [CONVENTIONAL]: {
            machine: { code: 'CNV-1', category: 'Conventional', cell: '2' },
            breakdowns: { count: 3 },
            pm: { visits: 0, hours: 0 },
            completeness: { recorded: 10, of: 10, missing: [] },
          },
        },
      },
      drill: { type: 'machine', ids: [] },
    },
    {
      key: 'reliability',
      screen: 'machine-page',
      owner: 67,
      status: 'ready',
      value: {
        asOf: AS_OF,
        windowStart: '2026-01-01',
        minimumEvents: 5,
        machines: {
          [FULL_ID]: {
            fit: FULL_FIT,
            spares: {
              rows: [
                {
                  name: 'Rectifier O/P 440V AC and I/P 190V DC',
                  uses: 1,
                  downtimeHours: 4,
                  lastOn: '2026-09-16',
                },
                {
                  name: 'Rectifier 440 O/P and I/P 190 VDC',
                  uses: 1,
                  downtimeHours: 3,
                  lastOn: '2026-07-18',
                },
                { name: 'Break Rectifier 2 amp', uses: 1, downtimeHours: 0, lastOn: '2026-10-03' },
                { name: 'Brake hub', uses: 1, downtimeHours: 0, lastOn: '2026-10-03' },
              ],
              total: 4,
            },
            drill: { fit: FIT_TICKETS, spares: SPARE_TICKETS },
          },
          [PARTIAL_ID]: {
            fit: {
              status: 'insufficient',
              ownEvents: 4,
              category: 'Turning Center',
              categoryEvents: 3,
              minimum: 5,
            },
            spares: {
              rows: SHOWN_PARTS.map(([name, uses, downtimeHours, lastOn]) => ({
                name,
                uses,
                downtimeHours,
                lastOn,
              })),
              total: 15,
            },
            drill: { fit: FIT_TICKETS, spares: SPARE_TICKETS },
          },
          [SPARELESS_ID]: {
            fit: {
              status: 'insufficient',
              ownEvents: 0,
              category: 'Vertical Machining Center',
              categoryEvents: 2,
              minimum: 5,
            },
            spares: { rows: [], total: 0 },
            drill: { fit: [], spares: [] },
          },
        },
        categories: {},
      },
      drill: { type: 'machine', ids: [FULL_ID, PARTIAL_ID, SPARELESS_ID] },
    },
  ],
};

async function stubFigures(page: Page, reply: FiguresReply = FIGURES): Promise<void> {
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: reply }));
}

/** The drill reply is one ticket row: the table the links open, without seeding a real breakdown. */
async function stubDrill(page: Page): Promise<string[]> {
  const asked: string[] = [];
  await page.route('**/api/v1/analytics/drill?*', (route) => {
    asked.push(decodeURIComponent(route.request().url()));
    return route.fulfill({
      json: {
        type: 'ticket',
        rows: [
          {
            id: FIT_TICKETS[0],
            ref: 'BD-2609-16-1',
            kind: 'stopped',
            status: 'closed',
            machineId: FULL_ID,
            reportedAt: '2026-09-16T08:00:00+05:30',
            closedAt: '2026-09-16T10:00:00+05:30',
            source: 'history',
            downtimeMin: 240,
            repairMin: 120,
            workType: 'E',
          },
        ],
      },
    });
  });
  return asked;
}

/** The region a section renders (its own heading names it). */
function region(page: Page, name: string) {
  return page.getByRole('region', { name, exact: true });
}

test('a head reads one machine’s fit, its parts, and drills from each', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  const asked = await stubDrill(page);
  await signIn(page, 'head');

  await page.goto(`/analytics/machines/${FULL_ID}`);
  await expect(page.getByRole('heading', { name: FULL.code, exact: true })).toBeVisible();

  // The fit: its own failures, three numbers, the sample, the quartiles and the word beside the slope.
  const fit = region(page, 'Reliability fit');
  await expect(fit.getByText("This machine's own failures", { exact: true })).toBeVisible();
  await expect(fit.getByText('0.88', { exact: true })).toBeVisible();
  await expect(fit.getByText('107.0', { exact: true })).toBeVisible();
  await expect(fit.getByText('114.1', { exact: true })).toBeVisible();
  await expect(
    fit.getByText('43 failures · 42 intervals · 70.0 censored hours', { exact: true }),
  ).toBeVisible();
  await expect(
    fit.getByText(
      'Kaplan-Meier: a quarter under 18.8 h, half under 51.4 h, three quarters under 135.5 h',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(fit.getByText('failures are coming faster', { exact: true })).toBeVisible();
  await expect(fit.getByText('slope 1.73 across 43 failures', { exact: true })).toBeVisible();

  // The critical spares: four rows, uses then downtime, the last day each was used.
  const spares = region(page, 'Critical spares');
  await expect(
    spares.getByRole('cell', { name: 'Rectifier O/P 440V AC and I/P 190V DC' }),
  ).toBeVisible();
  await expect(spares.getByRole('cell', { name: 'Break Rectifier 2 amp' })).toBeVisible();
  await expect(spares.getByRole('cell', { name: '03-10-2026', exact: true })).toHaveCount(2);
  await expect(spares.getByRole('cell', { name: '4.0', exact: true })).toBeVisible();
  await expect(spares.getByRole('cell', { name: '3.0', exact: true })).toBeVisible();
  await expect(spares.getByRole('cell', { name: '0.0', exact: true })).toHaveCount(2);
  await expect(spares.getByText('4 parts, 4 shown', { exact: true })).toHaveCount(0);

  // The fit's drill opens the machine page's drill table and names the tickets it asked for.
  await fit.getByRole('link', { name: 'See the rows', exact: true }).click();
  await expect(page).toHaveURL(/drill=ticket%3A/);
  await expect(
    page.getByRole('heading', { name: 'The rows behind this figure', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: 'BD-2609-16-1', exact: true })).toBeVisible();
  expect(asked.some((url) => FIT_TICKETS.every((id) => url.includes(id)))).toBe(true);

  // The spares' drill asks for the reports behind the listed parts.
  await spares.getByRole('link', { name: 'See the rows', exact: true }).click();
  await expect.poll(() => asked.some((url) => url.includes(SPARE_TICKETS[0]!))).toBe(true);
  await expect(page.getByRole('cell', { name: 'BD-2609-16-1', exact: true })).toBeVisible();
});

test('a machine with too little history and a machine with no spare say so', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await stubDrill(page);
  await signIn(page, 'head');

  // Four failures, three in its category, five needed: both counts print beside its own drill.
  await page.goto(`/analytics/machines/${PARTIAL_ID}`);
  const partial = region(page, 'Reliability fit');
  await expect(partial.getByText('Not enough history', { exact: true })).toBeVisible();
  await expect(
    partial.getByText('4 failures on this machine, 3 in Turning Center; the fit needs 5.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(partial.getByRole('link', { name: 'See the rows', exact: true })).toBeVisible();

  // Its spares list is the top five of fifteen.
  const parts = region(page, 'Critical spares');
  await expect(parts.getByRole('cell', { name: 'Seal 20422243', exact: true })).toBeVisible();
  await expect(parts.getByRole('cell', { name: '13.3', exact: true })).toBeVisible();
  await expect(parts.getByText('15 parts, 5 shown', { exact: true })).toBeVisible();

  // No failure and no part: "not enough history" and the empty spares line, with no link at all.
  await page.goto(`/analytics/machines/${SPARELESS_ID}`);
  await expect(
    region(page, 'Reliability fit').getByText('Not enough history', { exact: true }),
  ).toBeVisible();
  await expect(
    region(page, 'Critical spares').getByText(
      'No spare was recorded on this machine’s breakdowns.',
      { exact: true },
    ),
  ).toBeVisible();
  for (const name of ['Reliability fit', 'Critical spares'])
    await expect(
      region(page, name).getByRole('link', { name: 'See the rows', exact: true }),
    ).toHaveCount(0);
});

test('a machine outside the figure’s fleet and an uncomputed figure both say so', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');

  // The figure is ready but holds no entry for this machine: both sections are honest.
  await page.goto(`/analytics/machines/${CONVENTIONAL}`);
  await expect(
    region(page, 'Reliability fit').getByText('Not available', { exact: true }),
  ).toBeVisible();
  await expect(
    region(page, 'Critical spares').getByText('Not available', { exact: true }),
  ).toBeVisible();

  // An engine reply that has not computed reliability says so, not "Not available".
  const uncomputed: FiguresReply = {
    ...FIGURES,
    figures: FIGURES.figures.map((figure) =>
      figure.key === 'reliability' ? { ...figure, status: 'not_computed', value: null } : figure,
    ),
  };
  await page.unroute('**/api/v1/analytics/figures');
  await stubFigures(page, uncomputed);
  await page.goto(`/analytics/machines/${FULL_ID}`);
  await expect(
    region(page, 'Reliability fit').getByText('Not computed yet', { exact: true }),
  ).toBeVisible();
  await expect(
    region(page, 'Critical spares').getByText('Not computed yet', { exact: true }),
  ).toBeVisible();
});

test('an operator is refused the machine page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'op');

  await page.goto(`/analytics/machines/${FULL_ID}`);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Reliability fit', exact: true })).toHaveCount(0);
});
