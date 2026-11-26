import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { commandViaApi, getJson } from './fixtures-actions.js';
import { MACHINES, apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';

/**
 * 41e-2: the Why-Why screen. A head opens the candidate list, starts a Why-Why on the first candidate,
 * saves the five whys and the conclusion against the real ticket route, sees the row read Completed after the
 * figures reply is refetched, and downloads the saved record's PDF. The figures reply is stubbed (the face's
 * established seam) but is built from the real saved record, so the row can only read Completed after the
 * server accepted the save.
 *
 * Two candidates, on purpose: the engine lists rows worst hours first but sorts the drill ids, so the first row's
 * ticket is made the one whose id sorts LAST. A screen that paired rows with tickets by position in the drill would
 * save the first row's Why-Why on the second ticket; the test reads both tickets back to prove it did not.
 */

type Figure = FiguresReply['figures'][number];
type Ticket = { id: string; ref: string };

interface Me {
  user: { name: string; actingPersonId: string; actingPerson?: { name: string } | null };
}

const AS_OF = '2026-11-11';
const MACHINE = MACHINES[0]!;
const DATE = '10-11-2026';
const WHYS = [
  'The spindle stopped',
  'The bearing was dry',
  'The oil line was blocked',
  'The filter was never changed',
  'The PM checklist missed the filter',
];
const CONCLUSION = 'The bearing was worn because the oil line was blocked.';
const WORST_PROBLEM = 'A6: spindle noise';
const OTHER_PROBLEM = 'A6: coolant leak';

/** The worst-hours candidate (the first row) and the other one; the first's id sorts after the second's. */
let worst: Ticket;
let other: Ticket;
let headToken: string;
let headName: string;

/** A closed breakdown report on the machine: a ticket the A6 list could name. */
async function closedTicket(problem: string): Promise<Ticket> {
  const operator = await apiLogin('op');
  const maintenance = await apiLogin('asha');
  const personId = (await getJson<Me>(maintenance, '/api/v1/auth/me')).user.actingPersonId;
  const raised = await raiseTicketViaApi(operator, MACHINE.id, problem);
  await commandViaApi(maintenance, raised.id, 'start', { personId });
  await commandViaApi(maintenance, raised.id, 'close', {
    personId,
    kind: 'report',
    report: {
      problem,
      correctiveAction: 'Replaced the bearing',
      doneByPersonIds: [personId],
      failureComponent: 'M',
    },
  });
  return raised;
}

test.beforeAll(async () => {
  headToken = await apiLogin('head');
  const first = await closedTicket(WORST_PROBLEM);
  const second = await closedTicket(OTHER_PROBLEM);
  // The rows are worst first and the drill ids are sorted, so make the worst row's ticket the later id.
  [other, worst] = first.id < second.id ? [first, second] : [second, first];
  const me = (await getJson<Me>(headToken, '/api/v1/auth/me')).user;
  headName = me.actingPerson?.name ?? me.name;
});

const rowOf = (ticket: Ticket, problem: string, completed: boolean): string[] => [
  MACHINE.code,
  DATE,
  problem,
  ticket === worst ? '13.00' : '12.50',
  completed ? 'Completed' : 'Not Started',
  completed ? 'View / EditPDF' : 'Start Why-Why',
];

/** A6's key page: two candidates worst first, each row's status read from its real saved record. */
function a6Figure(completed: { worst: boolean; other: boolean }): Figure {
  const problemOf = (ticket: Ticket) => (ticket === worst ? WORST_PROBLEM : OTHER_PROBLEM);
  const ordered = [worst, other];
  return {
    key: 'a6-why-why',
    screen: 'a6-why-why',
    owner: 41,
    status: 'ready',
    value: {
      screen: 'a6-why-why',
      asOf: AS_OF,
      pages: [
        {
          page: 'a6',
          title: 'Why-Why Analysis',
          kpis: [],
          tables: [
            {
              title: 'Why-Why (Root Cause) Analysis',
              header: ['Machine', 'Date', 'Problem', 'Down (Hrs)', 'Status', ''],
              rows: ordered.map((ticket) =>
                rowOf(
                  ticket,
                  problemOf(ticket),
                  ticket === worst ? completed.worst : completed.other,
                ),
              ),
              rowCount: 2,
              rowTicketIds: ordered.map((ticket) => ticket.id),
            },
          ],
          charts: [],
        },
      ],
    },
    // The engine sorts the drill ids, so they are NOT in row order.
    drill: { type: 'ticket', ids: [worst.id, other.id].sort() },
  };
}

async function stubFigures(page: Page): Promise<void> {
  await page.route('**/api/v1/analytics/figures', async (route) => {
    const saved = async (ticket: Ticket) =>
      (await getJson<unknown | null>(headToken, `/api/v1/tickets/${ticket.id}/why-why`)) !== null;
    const reply: FiguresReply = {
      asOf: AS_OF,
      profile: {} as FiguresReply['profile'],
      excludedMachines: 0,
      rows: { machines: 12, moves: 0, tickets: 2, tasks: 0, reports: 2, people: 4 },
      figures: [a6Figure({ worst: await saved(worst), other: await saved(other) })],
    };
    await route.fulfill({ json: reply });
  });
}

test('a head starts a Why-Why on the first candidate, saves it, sees Completed and downloads the PDF', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');
  await page.goto('/analytics/breakdowns?screen=a6-why-why');

  const tabs = page.getByRole('group', { name: 'Breakdowns screens', exact: true });
  await expect(tabs.getByRole('button', { name: 'Why-Why', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('heading', { level: 1, name: 'Why-Why', exact: true })).toBeVisible();
  const table = page.getByRole('region', {
    name: 'Breakdowns that ran past the Why-Why limit',
    exact: true,
  });
  await expect(table).toBeVisible();
  // The row's machine is a chip and no ticket id is printed anywhere on the page.
  await expect(page.getByText(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/)).toHaveCount(0);
  const row = table.getByRole('row').nth(1);
  await expect(row.getByText('Not Started', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Start Why-Why', exact: true }).click();

  const form = page.getByRole('form', { name: 'Why-Why form', exact: true });
  await expect(form).toBeVisible();
  await expect(form.getByText(`Author: ${headName}`, { exact: true })).toBeVisible();
  for (const [index, why] of WHYS.entries())
    await form.getByLabel(`Why ${index + 1}`, { exact: true }).fill(why);
  // The conclusion is the one required field: the save stays refused until it is there.
  const save = form.getByRole('button', { name: 'Save Why-Why', exact: true });
  await expect(save).toBeDisabled();
  await form.getByLabel('Conclusion (required)', { exact: true }).fill(CONCLUSION);
  await expect(save).toBeEnabled();
  await save.click();

  await expect(form.getByText('Saved.', { exact: true })).toBeVisible();
  await expect(row.getByText('Completed', { exact: true })).toBeVisible();

  // The record went to the clicked row's own ticket, and the other candidate is untouched.
  const saved = await getJson<{ conclusion: string } | null>(
    headToken,
    `/api/v1/tickets/${worst.id}/why-why`,
  );
  expect(saved?.conclusion).toBe(CONCLUSION);
  expect(
    await getJson<unknown | null>(headToken, `/api/v1/tickets/${other.id}/why-why`),
  ).toBeNull();
  await expect(
    table.getByRole('row').nth(2).getByText('Not Started', { exact: true }),
  ).toBeVisible();
  // A completed row says View or edit, and opens its own saved record.
  await row.getByRole('button', { name: 'View or edit', exact: true }).click();
  await expect(form.getByLabel('Conclusion (required)', { exact: true })).toHaveValue(CONCLUSION);

  const download = page.waitForEvent('download');
  await form.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`WhyWhy_${MACHINE.code}_${DATE}.pdf`);
  const path = await file.path();
  expect(path).toBeTruthy();
  const bytes = await readFile(path as string);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
});

test('the page action opens the tickets the figure counted, and an old v1 address opens them on the v2 page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');
  await page.goto('/analytics/breakdowns?screen=a6-why-why');
  await page.getByRole('button', { name: /Show the rows behind Why-Why/ }).click();
  await expect(page).toHaveURL(/[?&]drawer=figure:a6-why-why$/);
  const drawer = page.locator('aside.v2-drawer');
  await expect(drawer.getByRole('link', { name: worst.ref, exact: true })).toBeVisible();
  await expect(drawer.getByRole('link', { name: other.ref, exact: true })).toBeVisible();
  const link = encodeURIComponent(`ticket:${[worst.id, other.id].sort().join(',')}`);
  await page.goto(`/analytics/breakdowns?screen=a6-why-why&drill=${link}`);
  await expect(page).toHaveURL(/[?&]drawer=figure:a6-why-why$/);
  await expect(page).not.toHaveURL(/drill=/);
  await expect(page.getByRole('heading', { level: 1, name: 'Why-Why', exact: true })).toBeVisible();
});

test('an operator is refused the Why-Why screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'op');
  await page.goto('/analytics/breakdowns?screen=a6-why-why');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Why-Why' })).toHaveCount(0);
});
