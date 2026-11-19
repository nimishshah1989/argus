import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { commandViaApi, getJson } from './fixtures-actions.js';
import { MACHINES, apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';

/**
 * 41e-2: the A6 Why-Why screen. A head opens the candidate list, starts a Why-Why on the first candidate,
 * saves the five whys and the conclusion against the real ticket route, sees the row read Completed after the
 * figures reply is refetched, and downloads the saved record's PDF. The figures reply is stubbed (the face's
 * established seam) but is built from the real saved record, so the row can only read Completed after the
 * server accepted the save.
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

let ticket: Ticket;
let headToken: string;
let headName: string;

test.beforeAll(async () => {
  const operator = await apiLogin('op');
  const maintenance = await apiLogin('asha');
  headToken = await apiLogin('head');
  const personId = (await getJson<Me>(maintenance, '/api/v1/auth/me')).user.actingPersonId;
  const raised = await raiseTicketViaApi(operator, MACHINE.id, 'A6: spindle noise');
  await commandViaApi(maintenance, raised.id, 'start', { personId });
  await commandViaApi(maintenance, raised.id, 'close', {
    personId,
    kind: 'report',
    report: {
      problem: 'A6: spindle noise',
      correctiveAction: 'Replaced the bearing',
      doneByPersonIds: [personId],
      failureComponent: 'M',
    },
  });
  ticket = raised;
  const me = (await getJson<Me>(headToken, '/api/v1/auth/me')).user;
  headName = me.actingPerson?.name ?? me.name;
});

/** A6's key page, with the row's status read from the real saved record. */
function a6Figure(completed: boolean): Figure {
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
              rows: [
                [
                  MACHINE.code,
                  DATE,
                  'A6: spindle noise',
                  '13.00',
                  completed ? 'Completed' : 'Not Started',
                  completed ? 'View / EditPDF' : 'Start Why-Why',
                ],
              ],
              rowCount: 1,
            },
          ],
          charts: [],
        },
      ],
    },
    drill: { type: 'ticket', ids: [ticket.id] },
  };
}

async function stubFigures(page: Page): Promise<void> {
  await page.route('**/api/v1/analytics/figures', async (route) => {
    const record = await getJson<unknown | null>(headToken, `/api/v1/tickets/${ticket.id}/why-why`);
    const reply: FiguresReply = {
      asOf: AS_OF,
      profile: {} as FiguresReply['profile'],
      excludedMachines: 0,
      rows: { machines: 12, moves: 0, tickets: 1, tasks: 0, reports: 1, people: 4 },
      figures: [a6Figure(record !== null)],
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

  const nav = page.getByRole('navigation', { name: 'Breakdowns screens', exact: true });
  await expect(nav.getByRole('link', { name: 'A6 Why-Why', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { name: 'Why-Why Analysis', exact: true })).toBeVisible();
  const table = page.getByRole('table', { name: 'Why-Why (Root Cause) Analysis', exact: true });
  await expect(table).toBeVisible();
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

  const download = page.waitForEvent('download');
  await form.getByRole('button', { name: 'Download PDF', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`WhyWhy_${MACHINE.code}_${DATE}.pdf`);
  const path = await file.path();
  expect(path).toBeTruthy();
  const bytes = await readFile(path as string);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
});
