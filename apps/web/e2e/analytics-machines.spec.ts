import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { MACHINES, signIn } from './fixtures.js';

/**
 * 39b: the Machines face (the registers and the cell change log are the v2 screens at their v1 addresses). A head opens a register page, the cell change log with its controlled-document export,
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
  excludedMachines: 0,
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
              topProblem: { problem: 'Tool declamp problem', count: 18 },
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

interface StubMove {
  id: string;
  machineId: string;
  date: string;
  fromCell: string;
  toCell: string;
}

/** The stub's one cell move: the row the correction journey acts on. */
function cellLogMove(reply: FiguresReply): StubMove {
  const figure = reply.figures.find((candidate) => candidate.key === 'cell-change-log');
  const value = figure?.value as { moves: StubMove[] } | undefined;
  const move = value?.moves[0];
  if (!move) throw new Error('the figures stub no longer holds a cell move');
  return move;
}

async function stubFigures(page: Page, reply: FiguresReply = FIGURES): Promise<void> {
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: reply }));
}

/** The stubbed PATCH: applies the correction to the stub, so the figures refetch shows the corrected day. */
async function stubCorrection(page: Page, figures: FiguresReply): Promise<void> {
  await page.route('**/api/v1/machines/*/moves/*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const body = route.request().postDataJSON() as { effectiveFrom: string };
    const move = cellLogMove(figures);
    move.date = body.effectiveFrom;
    await route.fulfill({
      json: {
        move: {
          id: move.id,
          machineId: move.machineId,
          fromCell: move.fromCell,
          toCell: move.toCell,
          effectiveFrom: move.date,
        },
      },
    });
  });
}

/** The head's correction: the sheet opens prefilled, the PATCH is sent, and the refetched row shows the day. */
async function correctFirstMove(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Correct date', exact: true }).first().click();
  const form = page.getByRole('form', { name: 'Correct the move date', exact: true });
  const date = form.getByLabel('New date', { exact: true });
  await expect(date).toHaveValue('2026-08-03');
  await date.fill('2026-08-04');
  const correcting = page.waitForResponse(
    (reply) =>
      reply.request().method() === 'PATCH' &&
      /\/api\/v1\/machines\/[^/]+\/moves\/[^/]+$/.test(new URL(reply.url()).pathname) &&
      reply.status() === 200,
  );
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await correcting).request().postDataJSON()).toEqual({ effectiveFrom: '2026-08-04' });
  await expect(page.getByText('Move date corrected.', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '04-Aug-2026', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '03-Aug-2026', exact: true })).toHaveCount(0);
}

/** A register page drills to the machines behind it (v1's "See the machines"), and each row opens its machine. */
async function drillRegister(page: Page, code: string): Promise<void> {
  await page.getByRole('button', { name: /Show the rows behind Registers and splits/ }).click();
  await expect(page).toHaveURL(/[?&]drawer=figure:registers$/);
  const rows = page.locator('aside.v2-drawer');
  await expect(rows.getByRole('button', { name: code, exact: true })).toBeVisible();
  await rows.getByRole('button', { name: code, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`[?&]drawer=machine:${code}$`));
  await page.goBack();
  await expect(page).toHaveURL(/[?&]drawer=figure:registers$/);
  await page.goBack();
  await expect(page).not.toHaveURL(/drawer=/);
}

test('a head opens a register page, the cell change log and a machine page that is honest about gaps', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const figures = structuredClone(FIGURES);
  await stubCorrection(page, figures);
  await stubFigures(page, figures);
  await signIn(page, 'head');

  // Machines opens on its registers: one page per register, the CNC page first, in the v2 shell at the same address.
  await page.goto('/analytics/machines');
  await expect(page.getByRole('heading', { level: 1, name: 'Machines register' })).toBeVisible();
  await expect(page.locator('.v2-lede')).toContainText('CNC Machines: 126');
  await expect(page.getByText('2,812.0 KVA', { exact: true })).toBeVisible();
  const registers = page.getByRole('group', { name: 'Registers', exact: true });
  await expect(registers.getByRole('button', { name: 'CNC', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await drillRegister(page, FULL.code);

  // The cell change log has its own page and its controlled-document export.
  await page
    .getByRole('group', { name: 'Machines screens', exact: true })
    .getByRole('button', { name: 'Cell change log', exact: true })
    .click();
  await expect(page).toHaveURL(/screen=cell-change-log/);
  await expect(page.getByRole('cell', { name: '03-Aug-2026', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Cell 4 → Cell 2', exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export to CSV', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^cell-change-log-\d{4}-\d{2}-\d{2}\.csv$/);
  const path = await file.path();
  expect(path).toBeTruthy();
  const csv = await readFile(path as string, 'utf8');
  expect(csv).toContain('DOC. NO. CE-MTN-F-01');
  expect(csv).toContain(`${FULL.code},4,2,434,841-B`);

  // A head corrects a move's date from the log.
  await correctFirstMove(page);

  // One machine page: its nameplate and every figure the record holds.
  await page.goto(`/analytics/machines/${FULL.id}`);
  await expect(page.getByRole('heading', { name: FULL.code, exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByText('Cosmos', { exact: true })).toBeVisible();
  await expect(page.getByText('CVM-800', { exact: true })).toBeVisible();
  await expect(page.getByText('10.00 m²', { exact: true })).toBeVisible();
  await expect(page.getByText('4.20 KVA', { exact: true })).toBeVisible();
  await expect(page.getByText('27', { exact: true })).toBeVisible();
  await expect(page.getByText('Tool declamp problem', { exact: true })).toBeVisible();
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

  // The server's refusal shows as the refused state: no register or machine content.
  await page.goto('/analytics/machines');
  await expect(page.getByText('Your login cannot open this page', { exact: false })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Registers', exact: true })).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);

  // The cell change log is the v2 page at the same URL: the server's refusal shows as the refused state, with no table.
  await page.goto('/analytics/machines?screen=cell-change-log');
  await expect(page.getByText('Your login cannot open this page', { exact: false })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);

  // Even with the log in hand, an operator gets no correction action: the role gate, not only the refusal.
  await stubFigures(page);
  await page.goto('/analytics/machines?screen=cell-change-log');
  await expect(page.getByRole('cell', { name: '03-Aug-2026', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Correct date', exact: true })).toHaveCount(0);
});

test('the cell change log is live on the real server: a head sees the page at its old address, in the new shell, with no error', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'head');
  await page.goto('/analytics/machines?screen=cell-change-log');
  await expect(page.getByRole('heading', { level: 1, name: 'Cell change log' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Machines', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('[data-state="loading"]')).toHaveCount(0);
});

test('a machine chip in the cell change log opens the plant’s own machine, and Back closes it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');
  await page.goto('/analytics/machines?screen=cell-change-log');
  await page.getByRole('button', { name: FULL.code, exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`[?&]drawer=machine:${FULL.code}`));
  const drawer = page.locator('aside.v2-drawer');
  await expect(drawer).not.toHaveAttribute('inert', '');
  await expect(drawer.getByRole('heading', { level: 2, name: 'Cosmos CVM-800' })).toBeVisible();
  await expect(drawer.getByText('We could not find this one', { exact: false })).toHaveCount(0);
  await page.goBack();
  await expect(drawer).toHaveAttribute('inert', '');
  await expect(page).not.toHaveURL(/drawer=/);
});

/** The frozen answer key of one figure: the screen is pinned to the engine's own page. */
function keyFigure(name: string, drill: FiguresReply['figures'][number]['drill']) {
  const value = JSON.parse(
    readFileSync(new URL(`../../../fixtures/answer-key/${name}.json`, import.meta.url), 'utf8'),
  ) as unknown;
  return { key: name, screen: name, owner: 39, status: 'ready' as const, value, drill };
}

for (const [screen, heading] of [
  ['a8-age', 'Age'],
  ['a7-footprint', 'Footprint'],
] as const) {
  test(`${heading} is live at its v1 address: a figure opens the machines behind it, and Back closes them`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const figure = keyFigure(screen, { type: 'machine', ids: [FULL.id, PARTIAL.id] });
    await stubFigures(page, { ...FIGURES, figures: [figure] });
    await signIn(page, 'head');
    await page.goto(`/analytics/machines?screen=${screen}`);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await page
      .getByRole('button', { name: /Show the rows behind/ })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`[?&]drawer=figure:${screen}$`));
    await expect(
      page.locator('aside.v2-drawer').getByRole('button', { name: FULL.code, exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(page).not.toHaveURL(/drawer=/);
  });
}
