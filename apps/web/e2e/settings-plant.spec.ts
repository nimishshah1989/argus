import { randomUUID } from 'node:crypto';
import { expect, test } from './test.js';
import { FLOOR_GROUP, MACHINES, apiFetch, apiLogin, signIn } from './fixtures.js';

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
  await form.getByLabel('Cell', { exact: true }).fill('9');
  await expect(
    form.getByText(`Moves ${machine.code} from Cell ${machine.cell} to Cell 9 from today`),
  ).toBeVisible();
  await form.getByRole('button', { name: 'B', exact: true }).click();
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form).toBeHidden();

  await page.reload();
  const row = page.getByRole('button', { name: `Edit ${machine.code}`, exact: true });
  await row.click();
  const reopened = page.getByRole('form', { name: `Edit ${machine.code}` });
  await expect(reopened.getByLabel('Cell', { exact: true })).toHaveValue('9');
  await expect(reopened.getByRole('button', { name: 'B', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('the group switch keeps the 44 px tap target at 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await signIn(page, 'admin');
  await page.goto('/settings/groups');
  const hide = page.getByRole('switch', { name: `Hide ${FLOOR_GROUP.name}`, exact: true });
  await expect(hide).toBeVisible();
  const box = await hide.boundingBox();
  if (!box) throw new Error('Visible switch has no bounding box');
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
});

test('settings leads back to the desk', async ({ page }, testInfo) => {
  const wide = testInfo.project.name === 'chromium';
  if (wide) await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'admin');
  await page.goto('/settings/machines');
  if (wide)
    await page
      .getByRole('navigation', { name: 'Settings' })
      .getByRole('link', { name: 'Open', exact: true })
      .click();
  else {
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('link', { name: 'Back to desk', exact: true }).click();
  }
  await expect(page).toHaveURL(/\/desk$/);
  await expect(page.getByRole('heading', { name: 'Open', exact: true })).toBeVisible();
});

test('a machine row shows its cell once, however the plant stored it', async ({ page }) => {
  const legacy = MACHINES[0]!;
  const token = await apiLogin('admin');
  const put = (cell: string) =>
    apiFetch(`/api/v1/machines/${legacy.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ cell }),
    });
  await signIn(page, 'admin');
  await page.goto('/settings/machines');
  // The plant stores a cell as its bare label; the row says it once.
  await expect(page.getByText('VMC · Cell 1', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Cell Cell/)).toHaveCount(0);

  // A row stored before that shape ("Cell-6") reads the same, never "Cell Cell-6".
  expect((await put('Cell-6')).ok).toBe(true);
  await page.reload();
  await expect(page.getByText('VMC · Cell 6', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Cell Cell/)).toHaveCount(0);
  expect((await put(legacy.cell)).ok).toBe(true);
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

test('a failed criticality save still shows the cell move that was saved', async ({
  page,
}, testInfo) => {
  const machine = MACHINES[testInfo.project.name === 'chromium' ? 6 : 7]!;
  await signIn(page, 'admin');
  await page.goto('/settings/machines');
  await page.route(`**/api/v1/machines/${machine.id}/criticality`, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );
  await page.getByRole('button', { name: `Edit ${machine.code}`, exact: true }).click();
  const form = page.getByRole('form', { name: `Edit ${machine.code}` });
  await form.getByLabel('Cell', { exact: true }).fill('8');
  await form.getByRole('button', { name: 'C', exact: true }).click();
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form.getByRole('alert')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText(/Cell 8/).first()).toBeVisible();
});
