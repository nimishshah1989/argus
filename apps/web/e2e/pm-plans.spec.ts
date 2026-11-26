import { Pool } from 'pg';
import type { Page } from '@playwright/test';
import { expect, test, type Translate } from './test.js';
import { TENANT, signIn } from './fixtures.js';
import { PM_METER, pmMachine, pmSettingsMachine } from './fixtures-pm.js';

/**
 * Ticket 49c: the phone's PM close and the plan behind it. A technician opens the PM job list, ticks the plan's
 * checklist, records the reading and the meter, writes a comment and finishes the job; the ticket closes with its
 * PM report and the plan moves. The settings journey edits the plan's interval on both a desktop and a phone.
 */

interface PlanRow {
  id: string;
  last_done_on: string | null;
  meter: number | null;
}

/** One read on the run's database (the e2e stack's admin pool), for the facts a screen does not show. */
async function rows<T>(sql: string, values: unknown[]): Promise<T[]> {
  const pool = new Pool({ connectionString: process.env.E2E_ADMIN_DATABASE_URL, max: 1 });
  try {
    return (await pool.query(sql, values)).rows as T[];
  } finally {
    await pool.end();
  }
}

async function planOf(machineId: string): Promise<PlanRow> {
  const [plan] = await rows<PlanRow>(
    `SELECT id, last_done_on::text AS last_done_on, last_meter_reading::float8 AS meter
       FROM pm_plan WHERE tenant_id = $1 AND machine_id = $2`,
    [TENANT.id, machineId],
  );
  if (!plan) throw new Error('the PM fixture wrote no plan');
  return plan;
}

/** The plant day the ticket closed on, which is the day the plan moves to. */
async function closedDay(machineId: string): Promise<string> {
  const [row] = await rows<{ day: string }>(
    `SELECT ((closed_at AT TIME ZONE 'Asia/Kolkata')::date)::text AS day
       FROM ticket WHERE tenant_id = $1 AND machine_id = $2 AND raised_channel = 'pm'
        AND status = 'closed' ORDER BY closed_at DESC LIMIT 1`,
    [TENANT.id, machineId],
  );
  return row!.day;
}

/** The value beside one fact's label on the ticket page. */
const fact = (page: Page, label: string) =>
  page.locator('dt', { hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::dd');

/** Open the PM tab's job, start it and open the PM close; answers the close form. */
async function openPmClose(
  page: Page,
  t: Translate,
  machineCode: string,
): Promise<ReturnType<Page['getByRole']>> {
  await page.goto('/floor/pm');
  await expect(page.getByRole('heading', { name: t('pm.jobs.title'), exact: true })).toBeVisible();
  const job = page.getByRole('link').filter({ hasText: machineCode });
  await expect(job).toContainText('WR-PM');
  await job.click();
  await expect(page).toHaveURL(/\/desk\/.+/);
  await page.getByRole('button', { name: t('action.label.start'), exact: true }).click();
  await page.getByRole('button', { name: t('pm.close.action'), exact: true }).click();
  const form = page.getByRole('form', { name: t('pm.close.title') });
  await expect(form).toBeVisible();
  return form;
}

/** Untick point 2, record the reading, the meter and a comment, and finish the PM. */
async function finishPm(form: ReturnType<Page['getByRole']>, t: Translate): Promise<void> {
  await form.getByLabel(t('pm.point', { n: 2 })).uncheck();
  await form.getByLabel('Backlash X').fill('0.01');
  await form.getByLabel(t('pm.close.meter')).fill(String(PM_METER));
  await form.getByLabel(t('pm.close.comment')).fill('Guard refitted');
  await form.getByRole('button', { name: t('pm.close.submit'), exact: true }).click();
}

/** The closed job's report card: the ticked count, the undone point, the reading, the meter and the comment. */
async function expectReport(page: Page, t: Translate): Promise<void> {
  await expect(fact(page, t('pm.close.checklist'))).toHaveText(
    t('pm.report.points', { done: 2, total: 3 }),
  );
  await expect(fact(page, t('pm.report.undone'))).toHaveText('2');
  await expect(fact(page, 'Backlash X')).toHaveText('0.01');
  await expect(fact(page, t('pm.report.meter'))).toHaveText(String(PM_METER));
  await expect(fact(page, t('pm.report.comment'))).toHaveText('Guard refitted');
  await expect(fact(page, t('pm.report.doneBy'))).toHaveText('Asha');
}

test('the technician ticks the plan, records the readings and finishes the PM', async ({
  page,
  t,
}, testInfo) => {
  const machine = pmMachine(testInfo.project.name);
  const plan = await planOf(machine.id);
  await signIn(page, 'asha');

  await test.step('the PM tab shows the job; starting it opens the PM close, not the breakdown report', async () => {
    await page.goto('/floor/pm');
    await expect(
      page
        .getByRole('navigation', { name: t('reportFloor.tabs') })
        .getByRole('link', { name: t('pm.jobs.tab') }),
    ).toBeVisible();
    const form = await openPmClose(page, t, machine.code);
    await expect(form.getByLabel(t('pm.point', { n: 1 }))).toBeChecked();
    await expect(form.getByLabel(t('pm.point', { n: 3 }))).toBeChecked();
    await expect(form.getByLabel('Backlash X')).toHaveValue('');
    await finishPm(form, t);
    await expect(
      page.locator('header').getByText(t('status.ticket.closed'), { exact: true }),
    ).toBeVisible();
  });

  await test.step('the report card shows the ticked count, the undone point, the reading and the comment', async () => {
    await expectReport(page, t);
  });

  await test.step('after a reload the job is still done, and the plan has moved', async () => {
    await page.reload();
    await expect(
      page.locator('header').getByText(t('status.ticket.closed'), { exact: true }),
    ).toBeVisible();
    await expectReport(page, t);
    const moved = await planOf(machine.id);
    expect(moved.id).toBe(plan.id);
    expect(moved.last_done_on).toBe(await closedDay(machine.id));
    expect(moved.meter).toBe(PM_METER);
    await page.goto('/floor/pm');
    await expect(page.getByRole('link').filter({ hasText: machine.code })).toHaveCount(0);
  });
});

test('an admin edits the plan’s interval on the settings screen and it persists', async ({
  page,
  t,
}, testInfo) => {
  const machine = pmSettingsMachine(testInfo.project.name);
  const title = `${machine.code} preventive maintenance`;
  await signIn(page, 'admin');
  await page.goto('/settings/pm-plans');
  await expect(page.getByRole('heading', { name: t('pm.plans.title'), exact: true })).toBeVisible();
  // The e2e plant has under 10 plans: one page, no search box (kit rule, ADR 0036 R13), so the row's Edit opens it.
  await page.getByRole('button', { name: t('kit.crud.editRow', { name: title }) }).click();

  const form = page.getByRole('form', { name: t('kit.crud.editRow', { name: title }) });
  await expect(form).toBeVisible();
  const interval = form.getByLabel(t('pm.plans.field.interval'), { exact: true });
  await expect(interval).toHaveValue('182');
  await interval.fill('90');
  await form.getByRole('button', { name: t('kit.crud.save'), exact: true }).click();
  await expect(form).toBeHidden();

  await page.reload();
  await page.getByRole('button', { name: t('kit.crud.editRow', { name: title }) }).click();
  await expect(
    page
      .getByRole('form', { name: t('kit.crud.editRow', { name: title }) })
      .getByLabel(t('pm.plans.field.interval'), { exact: true }),
  ).toHaveValue('90');
});
