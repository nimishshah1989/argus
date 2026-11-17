import type { Page } from '@playwright/test';
import { expect, test, type Translate } from './test.js';
import { apiLogin, floorMachine, raiseTicketViaApi } from './fixtures.js';

/**
 * Ticket 15: the floor reports a problem in v3's order (machine, situation, problem, Send) and sees the
 * ticket number. Every test owns one FL machine per project (fixtures.ts), so they run in any order.
 */
/** One API sign-in per user per worker: the login route allows 60 a minute per visitor. */
const tokens = new Map<string, Promise<string>>();
const token = (username: string): Promise<string> => {
  if (!tokens.has(username)) tokens.set(username, apiLogin(username));
  return tokens.get(username)!;
};

/**
 * Signed in with this worker's one API session for the user (the login screen itself is covered by the
 * other specs), then on the floor.
 */
async function openFloor(
  page: Page,
  t: Translate,
  uiLanguage: string,
  username: string,
): Promise<void> {
  const session = await token(username);
  await page.addInitScript((value) => localStorage.setItem('uptimo_token', value), session);
  await page.goto('/floor');
  await expect(page.locator('html')).toHaveAttribute('lang', uiLanguage);
  await expect(page.getByRole('heading', { name: t('floor.title') })).toBeVisible();
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const startsWith = (text: string): RegExp => new RegExp(`^${escapeRegExp(text)}`);

/** "Ticket number <ref>" in the tenant language, with the ref matched by `refPattern`. */
const ticketNumber = (t: Translate, refPattern: string): RegExp =>
  new RegExp(
    `^${escapeRegExp(t('reportFloor.ticketNumber', { ref: '\u0000' })).replace('\u0000', refPattern)}$`,
  );

const machineRow = (page: Page, code: string) =>
  page.getByRole('button', { name: new RegExp(`^${code}\\b`) });

async function findMachine(page: Page, t: Translate, code: string): Promise<void> {
  await page.getByLabel(t('reportFloor.find')).fill(code.replace('FL-', ''));
  await machineRow(page, code).click();
}

async function reportStopped(page: Page, t: Translate): Promise<void> {
  await page.getByRole('button', { name: startsWith(t('reportFloor.stopped')) }).click();
  await page.getByRole('button', { name: 'Spindle alarm', exact: true }).click();
  await expect(page.getByLabel(t('floor.problem'))).toHaveValue('Spindle alarm');
  await page.getByRole('button', { name: t('reportFloor.sendStopped'), exact: true }).click();
}

/** The lock gives Gujarati lines 1.55 (LOCK.md:30); English keeps Tailwind's preflight 1.5. */
test('a body line keeps English leading and gives Gujarati 1.55', async ({
  page,
  t,
  uiLanguage,
}) => {
  await openFloor(page, t, uiLanguage, 'op');
  const leading = await page.getByText(t('reportFloor.hint'), { exact: true }).evaluate((el) => {
    const style = getComputedStyle(el);
    return { lineHeight: style.lineHeight, fontSize: parseFloat(style.fontSize) };
  });
  const ratio = parseFloat(leading.lineHeight) / leading.fontSize;
  if (uiLanguage === 'gu') expect(ratio).toBeCloseTo(1.55, 2);
  else expect(ratio).toBe(1.5);
});

test('reports a stopped machine found by search in four taps and shows its number', async ({
  page,
  t,
  uiLanguage,
}, testInfo) => {
  const machine = floorMachine(1, testInfo.project.name);
  await openFloor(page, t, uiLanguage, 'op');
  await expect(page.getByRole('heading', { name: t('floor.whichMachine') })).toBeVisible();

  await findMachine(page, t, machine.code);
  await expect(page.getByRole('heading', { name: t('reportFloor.situation') })).toBeVisible();
  await reportStopped(page, t);

  await expect(page.getByRole('heading', { name: t('reportFloor.sent') })).toBeVisible();
  await expect(page.getByText(ticketNumber(t, 'BD-\\d{4,}'))).toBeVisible();
  await page.getByRole('button', { name: t('reportFloor.another'), exact: true }).click();
  await expect(page.getByRole('heading', { name: t('floor.whichMachine') })).toBeVisible();
  await expect(page.getByRole('button', { name: machine.code, exact: true })).toBeVisible();
});

test('reports a machine picked inside its group', async ({ page, t, uiLanguage }, testInfo) => {
  const machine = floorMachine(2, testInfo.project.name);
  await openFloor(page, t, uiLanguage, 'op');
  await page.getByRole('button', { name: /^FL Floor line/ }).click();
  await expect(page.getByLabel(t('reportFloor.machineId'))).toBeVisible();
  await machineRow(page, machine.code).click();
  await expect(page.getByText(machine.code, { exact: true })).toBeVisible();
  await reportStopped(page, t);
  await expect(page.getByText(ticketNumber(t, 'BD-\\d{4,}'))).toBeVisible();
});

test('a ?m= link opens the situation step for that machine', async ({
  page,
  t,
  uiLanguage,
}, testInfo) => {
  const machine = floorMachine(3, testInfo.project.name);
  await openFloor(page, t, uiLanguage, 'op');
  await page.goto(`/floor?m=${machine.code.toLowerCase().replace('-', ' ')}`);
  await expect(page.getByRole('heading', { name: t('reportFloor.situation') })).toBeVisible();
  await expect(page.getByText(machine.code, { exact: true })).toBeVisible();
});

test('a machine already reported opens its ticket instead of a second report', async ({
  page,
  t,
  uiLanguage,
}, testInfo) => {
  const machine = floorMachine(4, testInfo.project.name);
  const raised = await raiseTicketViaApi(await token('bina'), machine.id, 'Coolant leak');
  await openFloor(page, t, uiLanguage, 'op');
  await page.getByLabel(t('reportFloor.find')).fill(machine.code);
  const row = machineRow(page, machine.code);
  await expect(row).toContainText(t('reportFloor.alreadyReported'));
  await row.click();
  const sheet = page.getByRole('dialog', { name: machine.code });
  await expect(sheet).toContainText(raised.ref);
  await expect(sheet).toContainText('Coolant leak');
});

test('a stopped report on a machine with a support ticket upgrades that ticket', async ({
  page,
  t,
  uiLanguage,
}, testInfo) => {
  const machine = floorMachine(5, testInfo.project.name);
  const raised = await raiseTicketViaApi(await token('bina'), machine.id, 'Noise', 'support');
  // DOMAIN §3: upgradeKind is technician and above, so the operator case waits on a product ruling.
  await openFloor(page, t, uiLanguage, 'asha');
  await page.getByLabel(t('reportFloor.find')).fill(machine.code);
  await expect(machineRow(page, machine.code)).toContainText(t('reportFloor.needsSupport'));
  await machineRow(page, machine.code).click();
  await expect(page.getByText(t('reportFloor.supportTicket', { ref: raised.ref }))).toBeVisible();
  await page.getByRole('button', { name: startsWith(t('reportFloor.stopped')) }).click();
  await page.getByRole('button', { name: t('reportFloor.sendStopped'), exact: true }).click();
  await expect(page.getByRole('heading', { name: t('reportFloor.sent') })).toBeVisible();
  await expect(page.getByText(t('reportFloor.ticketNumber', { ref: raised.ref }))).toBeVisible();
  await expect(page.getByText(t('status.ticket.stopped'), { exact: true })).toBeVisible();
});

test('other work sends a work request with its number', async ({ page, t, uiLanguage }) => {
  await openFloor(page, t, uiLanguage, 'op');
  await page.getByRole('button', { name: startsWith(t('reportFloor.other')) }).click();
  await page.getByLabel(t('reportFloor.typePlace')).fill('Store room');
  await page.getByLabel(t('reportFloor.workType')).selectOption({ label: 'Preventive' });
  await page.getByLabel(t('reportFloor.needed')).fill('Fix the tube light');
  await expect(
    page.getByText(t('reportFloor.reportingAs', { who: 'Omi (Operator)' })),
  ).toBeVisible();
  await page.getByRole('button', { name: t('reportFloor.sendWork'), exact: true }).click();
  await expect(page.getByRole('heading', { name: t('reportFloor.sent') })).toBeVisible();
  await expect(page.getByText(ticketNumber(t, '[A-Z]+-\\d{4,}'))).toBeVisible();
});

test('maintenance can start work on the ticket it reports', async ({
  page,
  t,
  uiLanguage,
}, testInfo) => {
  const machine = floorMachine(6, testInfo.project.name);
  await openFloor(page, t, uiLanguage, 'asha');
  await findMachine(page, t, machine.code);
  await page.getByRole('button', { name: startsWith(t('reportFloor.stopped')) }).click();
  await page.getByLabel(t('floor.problem')).fill('Hydraulic pressure low');
  await page.getByRole('checkbox', { name: t('reportFloor.startNow') }).check();
  await page.getByRole('button', { name: t('reportFloor.sendStopped'), exact: true }).click();
  await expect(page.getByRole('heading', { name: t('reportFloor.sent') })).toBeVisible();
  await expect(page.getByText(t('status.ticket.inProgress'), { exact: true })).toBeVisible();
});

test('My complaints lists what this person reported with the floor words', async ({
  page,
  t,
  uiLanguage,
}, testInfo) => {
  const machine = floorMachine(7, testInfo.project.name);
  const raised = await raiseTicketViaApi(await token('op'), machine.id, 'Chuck not clamping');
  await openFloor(page, t, uiLanguage, 'op');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: t('floor.complaints') })
    .click();
  await expect(page.getByRole('heading', { name: t('floor.complaints') })).toBeVisible();
  const card = page.getByRole('listitem').filter({ hasText: raised.ref });
  await expect(card).toContainText(machine.code);
  await expect(card).toContainText('Chuck not clamping');
  await expect(card).toContainText(t('status.floor.booked'));
});

test('the header pill shows only offline; the problem step says so and Send waits for a connection', async ({
  page,
  context,
  t,
  uiLanguage,
}, testInfo) => {
  const machine = floorMachine(8, testInfo.project.name);
  await openFloor(page, t, uiLanguage, 'op');
  await findMachine(page, t, machine.code);
  await page.getByRole('button', { name: startsWith(t('reportFloor.stopped')) }).click();
  await page.getByLabel(t('floor.problem')).fill('Spindle alarm');
  // Online the floor header stays quiet (as the mockups); the pill speaks only when something is wrong.
  await expect(page.getByTestId('sync-status')).toHaveText('');
  await context.setOffline(true);
  await expect(page.getByTestId('sync-status')).toHaveText(
    new RegExp(escapeRegExp(t('status.sync.offline'))),
  );
  await expect(page.getByText(t('kit.form.needsConnection'))).toBeVisible();
  await expect(
    page.getByRole('button', { name: t('reportFloor.sendStopped'), exact: true }),
  ).toBeDisabled();
  await context.setOffline(false);
});
