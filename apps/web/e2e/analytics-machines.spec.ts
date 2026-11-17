import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { MACHINES, signIn } from './fixtures.js';

/**
 * 39b: the Machines face. A head opens a register page, the cell change log with its controlled-document export,
 * and one machine page that says "Not available" where the plant never recorded a length or a purchase date.
 * The engine replies are stubbed so the journey proves the screens, not packet 39a's progress.
 */

const FULL = MACHINES[0];
const PARTIAL = MACHINES[1];

if (!FULL || !PARTIAL)
  throw new Error('the fixtures no longer hold the two machines this spec opens');

const AS_OF = '2026-11-17';

const FIGURES: FiguresReply = {
  asOf: AS_OF,
  profile: {} as FiguresReply['profile'],
  rows: { machines: 2, moves: 1, tickets: 0, tasks: 0, reports: 0, people: 0 },
  figures: [
    {
      key: 'registers',
      screen: 'registers',
      owner: 39,
      status: 'ready',
      value: {
        pages: [
          {
            page: 'machines',
            title: 'CNC Machines',
            kpis: [
              { label: 'CNC Machines', value: '126', sub: '15 categories' },
              { label: 'Connected Load', value: '2,812.0 KVA', sub: 'all have power data' },
            ],
            tables: [
              {
                title: 'By Category',
                header: ['Category', 'Machines'],
                rows: [['Turning Center', '38']],
              },
            ],
          },
          {
            page: 'conv',
            title: 'Conventional Machines',
            kpis: [{ label: 'Conventional Machines', value: '19', sub: '6 categories' }],
            tables: [],
          },
        ],
      },
      drill: { type: 'machine', ids: [FULL.id, PARTIAL.id] },
    },
    {
      key: 'cell-change-log',
      screen: 'cell-change-log',
      owner: 39,
      status: 'ready',
      value: {
        moves: [
          {
            id: '10000000-0000-4000-8000-00000000a001',
            machineId: FULL.id,
            date: '2026-08-03',
            fromCell: '4',
            toCell: '2',
            fromLocation: '434',
            toLocation: '841-B',
          },
        ],
      },
      drill: { type: 'move', ids: ['10000000-0000-4000-8000-00000000a001'] },
    },
    {
      key: 'machine-page',
      screen: 'machine-page',
      owner: 39,
      status: 'ready',
      value: {
        byMachine: {
          [FULL.id]: {
            machine: {
              code: FULL.code,
              segment: 'CNC',
              category: FULL.category,
              make: 'Cosmos',
              model: 'CVM-800',
              serial: '08 3877',
              controller: 'Mitsubishi M80',
              controllerModel: 'FCA80H-4AV',
              year: 2022,
              purchasedOn: '2022-09-01',
              powerKva: 21,
              location: '486',
              cell: FULL.cell,
              assetCode: '13000081',
              lengthMm: 4000,
              widthMm: 2500,
              conveyor: 'L',
            },
            efficiencyPct: 20,
            breakdowns: {
              count: 27,
              hours: 151.32,
              mttr: 5.6,
              lastOn: '2026-11-07',
              topProblem: 'Tool declamp problem',
            },
            pm: { visits: 0, hours: 0 },
            completeness: { recorded: 10, of: 10, missing: [] },
          },
          [PARTIAL.id]: {
            machine: {
              code: PARTIAL.code,
              category: PARTIAL.category,
              make: 'Cosmos',
              model: 'CVM-800',
              cell: PARTIAL.cell,
            },
            breakdowns: { count: 0 },
            completeness: {
              recorded: 4,
              of: 10,
              missing: ['lengthMm', 'widthMm', 'purchasedOn'],
            },
          },
        },
      },
      drill: { type: 'machine', ids: [] },
    },
  ],
};

async function stubFigures(page: Page): Promise<void> {
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: FIGURES }));
}

test('a head opens a register page, the cell change log and a machine page that is honest about gaps', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');

  // Machines opens on its registers: one page per register, the CNC page first.
  await page.goto('/analytics/machines');
  await expect(page.getByRole('heading', { name: 'Machines', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'CNC Machines', exact: true })).toBeVisible();
  await expect(page.getByText('2,812.0 KVA', { exact: true })).toBeVisible();
  const registers = page.getByRole('navigation', { name: 'Registers', exact: true });
  await expect(registers.getByRole('link', { name: 'CNC', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // A register page drills to the machines behind it, and each row opens its machine page.
  await page.getByRole('link', { name: 'See the machines', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'The rows behind this figure', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: FULL.code, exact: true })).toBeVisible();

  // The cell change log has its own page and its controlled-document export.
  await page
    .getByRole('navigation', { name: 'Machines screens', exact: true })
    .getByRole('link', { name: 'Cell change log', exact: true })
    .click();
  await expect(page).toHaveURL(/screen=cell-change-log/);
  await expect(page.getByRole('cell', { name: '03-08-2026', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '4 → 2', exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export to CSV', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^cell-change-log-\d{4}-\d{2}-\d{2}\.csv$/);
  const path = await file.path();
  expect(path).toBeTruthy();
  const csv = await readFile(path as string, 'utf8');
  expect(csv).toContain('DOC. NO. CE-MTN-F-01');
  expect(csv).toContain(`${FULL.code},4,2,434,841-B`);

  // One machine page: its nameplate and every figure the record holds.
  await page.goto(`/analytics/machines/${FULL.id}`);
  await expect(page.getByRole('heading', { name: FULL.code, exact: true })).toBeVisible();
  await expect(page.getByText('Cosmos', { exact: true })).toBeVisible();
  await expect(page.getByText('CVM-800', { exact: true })).toBeVisible();
  await expect(page.getByText('10.00 m²', { exact: true })).toBeVisible();
  await expect(page.getByText('4.20 KVA', { exact: true })).toBeVisible();
  await expect(page.getByText('27', { exact: true })).toBeVisible();
  await expect(page.getByText('10 of 10 fields', { exact: true })).toBeVisible();

  // A machine with no length, width or purchase date says so, never a fabricated number.
  await page.goto(`/analytics/machines/${PARTIAL.id}`);
  await expect(page.getByRole('heading', { name: PARTIAL.code, exact: true })).toBeVisible();
  await expect(page.getByText('Length and width are not recorded', { exact: true })).toBeVisible();
  await expect(
    page.getByText('No purchase date or year is recorded', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Missing: Length, Width, Date of purchase', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Not available', { exact: true }).first()).toBeVisible();
});

test('an operator is refused the machines face', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'op');

  // The engine's reply is the refusal; the face shows its error notice and no register or machine content.
  await page.goto('/analytics/machines');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'CNC Machines', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Registers', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Cell change log', exact: true })).toHaveCount(0);
});
