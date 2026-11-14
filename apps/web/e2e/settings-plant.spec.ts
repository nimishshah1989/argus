import { randomUUID } from 'node:crypto';
import { expect, test } from './test.js';
import { FLOOR_GROUP, MACHINES, signIn } from './fixtures.js';

test('admin moves a machine to another cell and sets its criticality', async ({
  page,
}, testInfo) => {
  const machine = MACHINES[testInfo.project.name === 'chromium' ? 4 : 5]!;
  const wide = testInfo.project.name === 'chromium';
  if (wide) await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'admin');
  await page.goto('/settings/machines');
  await expect(page.getByRole('heading', { name: 'Machines', exact: true })).toBeVisible();
  if (wide) {
    await expect(page.getByRole('navigation', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Criticality' })).toBeVisible();
  }

  await page.getByRole('button', { name: `Edit ${machine.code}`, exact: true }).click();
  const form = page.getByRole('form', { name: `Edit ${machine.code}` });
  await form.getByLabel('Cell', { exact: true }).fill('Cell-9');
  await expect(
    form.getByText(`Moves ${machine.code} from ${machine.cell} to Cell-9 from today`),
  ).toBeVisible();
  await form.getByRole('button', { name: 'B', exact: true }).click();
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form).toBeHidden();

  await page.reload();
  const row = page.getByRole('button', { name: `Edit ${machine.code}`, exact: true });
  await row.click();
  const reopened = page.getByRole('form', { name: `Edit ${machine.code}` });
  await expect(reopened.getByLabel('Cell', { exact: true })).toHaveValue('Cell-9');
  await expect(reopened.getByRole('button', { name: 'B', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('admin hides a group and it stays hidden', async ({ page }) => {
  await signIn(page, 'admin');
  await page.goto('/settings/groups');
  await expect(page.getByRole('heading', { name: 'Segments and groups' })).toBeVisible();
  const hide = page.getByRole('switch', { name: `Hide ${FLOOR_GROUP.name}`, exact: true });
  await expect(hide).toHaveAttribute('aria-checked', 'false');
  await hide.click();
  await expect(hide).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(hide).toHaveAttribute('aria-checked', 'true');
  await hide.click();
  await expect(hide).toHaveAttribute('aria-checked', 'false');
});

test('admin adds a shift that crosses midnight', async ({ page }) => {
  const code = `N${randomUUID().slice(0, 6)}`;
  await signIn(page, 'admin');
  await page.goto('/settings/shifts');
  await expect(page.getByRole('heading', { name: 'Shifts', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add shift', exact: true }).click();
  const form = page.getByRole('form', { name: 'Add shift' });
  await form.getByLabel('Code', { exact: true }).fill(code);
  await form.getByLabel('Name', { exact: true }).fill(`Night ${code}`);
  await form.getByLabel('Starts at', { exact: true }).fill('22:00');
  await form.getByLabel('Ends at', { exact: true }).fill('06:00');
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form).toBeHidden();

  await page.reload();
  const row = page.getByText(`Night ${code}`, { exact: true });
  await expect(row).toBeVisible();
  await expect(page.getByText('22:00 to 06:00 · crosses midnight').first()).toBeVisible();
  await page.getByRole('button', { name: `Switch off Night ${code}`, exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Switch on Night ${code}`, exact: true }),
  ).toBeVisible();
});

test('a technician who opens plant settings is told they have no access', async ({ page }) => {
  await signIn(page, 'asha');
  await page.goto('/settings/machines');
  await expect(
    page.getByRole('heading', { name: 'No settings access', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0);
});
