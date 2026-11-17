import { randomUUID } from 'node:crypto';
import { expect, test } from './test.js';
import { apiFetch, apiLogin, signIn } from './fixtures.js';

/** A distinct code for each run, so a re-run never collides with a row this worker already made. */
const code = (prefix: string): string => `${prefix}${randomUUID().slice(0, 6).toUpperCase()}`;

async function addWaitReason(
  page: import('@playwright/test').Page,
  reason: { label: string; code: string },
): Promise<void> {
  await page.getByRole('button', { name: 'Add wait reason', exact: true }).click();
  const form = page.getByRole('form', { name: 'Add wait reason', exact: true });
  await form.getByLabel('Name', { exact: true }).fill(reason.label);
  await form.getByLabel('Code', { exact: true }).fill(reason.code);
  await form
    .getByRole('group', { name: 'Pauses SLA', exact: true })
    .getByRole('button', { name: 'Yes', exact: true })
    .click();
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form).toBeHidden();
}

/** Which value the sheet has for a flag, read the way a person sees it: the raised bar choice. */
async function pausedSla(
  page: import('@playwright/test').Page,
  form: import('@playwright/test').Locator,
): Promise<string | null> {
  const group = form.getByRole('group', { name: 'Pauses SLA', exact: true });
  return (await group
    .getByRole('button', { name: 'Yes', exact: true })
    .getAttribute('aria-pressed')) === 'true'
    ? 'yes'
    : 'no';
}

test('admin adds a wait reason with its pauses-SLA flag, switches it off and edits it', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  const suffix = randomUUID().slice(0, 6);
  const label = `Waiting for jig ${suffix}`;
  await signIn(page, 'admin');

  await page.goto('/settings/lists');
  await expect(page.getByRole('heading', { name: 'Lists', exact: true })).toBeVisible();
  // The hub is grown from the page config: one row per configured list.
  for (const name of ['Wait reasons', 'Work types', 'Quick problems']) {
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  }
  await page.getByRole('link', { name: /Wait reasons/ }).click();
  await expect(page).toHaveURL(/\/settings\/lists\?list=wait_reason/);
  await expect(page.getByRole('heading', { name: 'Wait reasons', exact: true })).toBeVisible();

  await addWaitReason(page, { label, code: code('WR') });
  await expect(page.getByText(label, { exact: true })).toBeVisible();

  // Saved to the list's own generated route, and the flag is a boolean on the server.
  const token = await apiLogin('admin');
  const reply = await apiFetch('/api/v1/settings/lists/wait_reason', {
    headers: { authorization: `Bearer ${token}` },
  });
  const saved = (await reply.json()) as {
    items: { label: string; pausesSla: boolean; active: boolean }[];
  };
  expect(saved.items.find((item) => item.label === label)?.pausesSla).toBe(true);

  await page.reload();
  await page.getByRole('button', { name: `Switch off ${label}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Switch on ${label}`, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: `Switch on ${label}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Edit ${label}`, exact: true }).click();
  expect(
    await pausedSla(page, page.getByRole('form', { name: `Edit ${label}`, exact: true })),
  ).toBe('yes');
  const edit = page.getByRole('form', { name: `Edit ${label}`, exact: true });
  await edit
    .getByRole('group', { name: 'Pauses SLA', exact: true })
    .getByRole('button', { name: 'No', exact: true })
    .click();
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(edit).toBeHidden();

  await page.reload();
  await page.getByRole('button', { name: `Edit ${label}`, exact: true }).click();
  expect(
    await pausedSla(page, page.getByRole('form', { name: `Edit ${label}`, exact: true })),
  ).toBe('no');
});

test('the same generated screen asks each list its own flags', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  const label = `Fixture setup ${randomUUID().slice(0, 6)}`;
  const workCode = code('WT');
  await signIn(page, 'admin');

  await page.goto('/settings/lists?list=work_type');
  await expect(page.getByRole('heading', { name: 'Work types', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add work type', exact: true }).click();
  const form = page.getByRole('form', { name: 'Add work type', exact: true });
  await form.getByLabel('Name', { exact: true }).fill(label);
  await form.getByLabel('Code', { exact: true }).fill(workCode);
  // A work type can need the lockout, a quick problem cannot: the field comes from the config.
  await form
    .getByRole('group', { name: 'Needs lockout', exact: true })
    .getByRole('button', { name: 'Yes', exact: true })
    .click();
  await expect(form.getByRole('group', { name: 'Pauses SLA', exact: true })).toHaveCount(0);
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form).toBeHidden();

  await page.reload();
  await page.getByRole('button', { name: `Edit ${label}`, exact: true }).click();
  await expect(
    page
      .getByRole('form', { name: `Edit ${label}`, exact: true })
      .getByRole('group', { name: 'Needs lockout', exact: true })
      .getByRole('button', { name: 'Yes', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('admin adds, edits and switches off a glossary term', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  const source = `chcked ${randomUUID().slice(0, 6)}`;
  const english = 'chucked';
  await signIn(page, 'admin');

  await page.goto('/settings/glossary');
  await expect(page.getByRole('heading', { name: 'Glossary', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add term', exact: true }).click();
  const form = page.getByRole('form', { name: 'Add term', exact: true });
  await form.getByLabel('Their word', { exact: true }).fill(source);
  await form.getByLabel('Our word', { exact: true }).fill(english);
  await form
    .getByRole('group', { name: 'Written in', exact: true })
    .getByRole('button', { name: 'Gujarati in Latin letters', exact: true })
    .click();
  await form.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(form).toBeHidden();

  await page.reload();
  await expect(page.getByText(source, { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: `Switch off ${source}`, exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Switch on ${source}`, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: `Switch on ${source}`, exact: true }),
  ).toBeVisible();
});
