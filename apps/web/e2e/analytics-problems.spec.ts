import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { openShowDetail } from './show-detail.js';
import { commandViaApi, getJson } from './fixtures-actions.js';
import { apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';

/**
 * 41e-2: the A10 Problem Analysis screen. A head opens A10, sees the key's eight KPIs and both charts, the groups
 * table sorts by a numeric column and back, and the figure's drill opens its ticket rows through the existing
 * seam. The figures reply is stubbed (the face's established seam) with the frozen key page, so the screen is
 * proved against the key; the drill rows are real tickets the server returns.
 */

type Figure = FiguresReply['figures'][number];
type Ticket = { id: string; ref: string };

const AS_OF = '2026-11-11';

/** The frozen A10 key: the screen is pinned to the answer key's own page, never a hand-copied table. */
const A10_KEY = JSON.parse(
  readFileSync(new URL('../../../fixtures/answer-key/a10-problems.json', import.meta.url), 'utf8'),
) as {
  pages: {
    title: string;
    kpis: { label: string; value: string; sub: string }[];
    tables: { title: string; header: string[]; rows: string[][]; rowCount: number }[];
    charts: { id: string; axes: { x: string; y: string }; labels: string[] }[];
  }[];
};

const PAGE = A10_KEY.pages[0]!;
const GROUPS = PAGE.tables[0]!;
const UNPLACED = PAGE.tables[3]!;

let tickets: { first: Ticket; second: Ticket };

test.beforeAll(async () => {
  const token = await apiLogin('head');
  const me = await getJson<{ user: { actingPersonId: string } }>(token, '/api/v1/auth/me');
  const first = await raiseTicketViaApi(token, null, 'A10: axis motor overcurrent');
  const second = await raiseTicketViaApi(token, null, 'A10: coolant leakage');
  for (const ticket of [first, second])
    await commandViaApi(token, ticket.id, 'cancel', {
      personId: me.user.actingPersonId,
      reason: 'A10 problem screen spec',
    });
  tickets = { first, second };
});

function a10Figure(): Figure {
  return {
    key: 'a10-problems',
    screen: 'a10-problems',
    owner: 41,
    status: 'ready',
    value: A10_KEY,
    drill: { type: 'ticket', ids: [tickets.first.id, tickets.second.id] },
  };
}

async function stubFigures(page: Page): Promise<void> {
  const reply: FiguresReply = {
    asOf: AS_OF,
    profile: {} as FiguresReply['profile'],
    excludedMachines: 0,
    rows: { machines: 12, moves: 0, tickets: 2, tasks: 0, reports: 2, people: 4 },
    figures: [a10Figure()],
  };
  await page.route('**/api/v1/analytics/figures', (route) => route.fulfill({ json: reply }));
}

/** The groups table's first data row, read as the screen prints it. */
async function firstGroup(page: Page): Promise<string> {
  const table = page.getByRole('region', { name: GROUPS.title, exact: true });
  return (await table.getByRole('row').nth(1).getByRole('cell').first().innerText()).trim();
}

/** A numeric cell as a number, so the expected order comes from the key itself. */
function cellNumber(cell: string): number {
  return Number(cell.replaceAll(',', ''));
}

test('a head opens A10, sees its eight KPIs and both charts, sorts the groups and drills its rows', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');
  await page.goto('/analytics/breakdowns?screen=a10-problems');

  const tabs = page.getByRole('group', { name: 'Breakdowns screens', exact: true });
  await expect(
    tabs.getByRole('button', { name: 'A10 problem analysis', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Problem Analysis' })).toBeVisible();

  // The 4 page KPIs and the 4 what-if KPIs, every label and value from the key (the folded ones behind Show detail).
  await openShowDetail(
    page,
    page.getByRole('region', { name: PAGE.kpis[0]!.label, exact: true }).first(),
  );
  for (const kpi of PAGE.kpis) {
    await expect(page.getByText(kpi.label, { exact: true })).toBeVisible();
    await expect(page.getByText(kpi.value, { exact: true }).first()).toBeVisible();
  }

  // Both charts as kit pieces (ADR 0043): the costliest problems as a ranked list, often-or-long as a quadrant,
  // each under the platform's card title.
  await expect(page.locator('ol.v2-ranked')).toBeVisible();
  await expect(page.locator('svg.v2-quad')).toBeVisible();
  await expect(page.getByText('Which problems cost the most?', { exact: true })).toBeVisible();
  await expect(page.getByText('Often, or long?', { exact: true })).toBeVisible();

  // The groups table, whole, with its key header.
  const groups = page.getByRole('region', { name: GROUPS.title, exact: true });
  await expect(groups).toBeVisible();
  await expect(groups.getByText(new RegExp(`^1–\\d+ of ${GROUPS.rows.length}$`))).toBeVisible();
  for (const heading of GROUPS.header)
    await expect(groups.getByRole('columnheader', { name: heading, exact: true })).toBeVisible();

  // A numeric sort click orders the table by it (largest first), and the second click reverses it.
  const hours = [...GROUPS.rows].sort(
    (left, right) => cellNumber(left[4]!) - cellNumber(right[4]!),
  );
  const header = groups.getByRole('columnheader', { name: 'Hours', exact: true });
  await expect(header).not.toHaveAttribute('aria-sort', /ascending|descending/);
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  expect(await firstGroup(page)).toBe(GROUPS.rows[0]![0]);
  await header.getByRole('button').press('Enter');
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  expect(await firstGroup(page)).toBe(hours[0]![0]);

  // The unplaced card follows the key's own group and Accept cells, and is not a suggestion control.
  const unplaced = page.getByRole('region', { name: UNPLACED.title, exact: true });
  await expect(unplaced).toBeVisible();
  const firstUnplaced = unplaced.getByRole('row').nth(1);
  // The platform printed the drop-down's every option into the cell; the screen keeps the chosen suggestion only.
  const suggestion =
    /^Suggested: .+? \(\d+%\)/.exec(UNPLACED.rows[0]![4]!)?.[0] ?? UNPLACED.rows[0]![4]!;
  await expect(firstUnplaced.getByRole('cell').nth(4)).toHaveText(suggestion);
  await expect(firstUnplaced.getByRole('cell').nth(5)).toHaveText(UNPLACED.rows[0]![5]!);

  // The figure's drill opens the real ticket rows in the drawer.
  await page.getByRole('button', { name: /Show the rows behind A10 problem analysis/ }).click();
  await expect(page).toHaveURL(/[?&]drawer=figure:a10-problems$/);
  const drill = page.locator('aside.v2-drawer');
  await expect(drill.locator('tbody tr')).toHaveCount(2);
  await expect(drill.getByRole('link', { name: tickets.first.ref, exact: true })).toBeVisible();
  await expect(drill.getByRole('link', { name: tickets.second.ref, exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/drawer=/);
});
