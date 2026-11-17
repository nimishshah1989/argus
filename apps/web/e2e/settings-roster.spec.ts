import { expect, test } from './test.js';
import { apiFetch, apiLogin, signIn } from './fixtures.js';

/** The plant's own day: the roster form, the copy action and the server's roster floor all mean this one. */
const plantDay = (offset = 0): string => {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + offset);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(day);
};

async function api<T>(path: string, token: string): Promise<T> {
  const reply = await apiFetch(path, { headers: { authorization: `Bearer ${token}` } });
  expect(reply.ok, `${path}: ${reply.status}`).toBe(true);
  return (await reply.json()) as T;
}

test('admin copies a day’s roster to the next seven days from Settings', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'chromium')
    await page.setViewportSize({ width: 1440, height: 900 });
  const today = plantDay();
  const token = await apiLogin('admin');
  const shifts = await api<{ items: { id: string; name: string }[] }>('/api/v1/shifts', token);
  const people = await api<{ items: { id: string; name: string; active: boolean }[] }>(
    '/api/v1/people',
    token,
  );
  const shift = shifts.items[0]!;
  const person = people.items.find((it) => it.active)!;

  // One line for today, seeded through the API: the copy action is what this test proves.
  const seeded = await apiFetch('/api/v1/roster', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ date: today, shiftId: shift.id, personId: person.id, level: 'L1' }),
  });
  expect(seeded.status, await seeded.text()).toBe(201);

  await signIn(page, 'admin');
  await page.goto('/settings/roster');
  await expect(page.getByRole('heading', { name: 'Duty roster', exact: true })).toBeVisible();
  await expect(page.getByLabel('Day to copy', { exact: true })).toHaveValue(today);

  await page.getByRole('button', { name: 'Copy to the next 7 days', exact: true }).click();
  await expect(
    page.getByText('Copied 7 lines; 0 were already there.', { exact: true }),
  ).toBeVisible();

  // The copied line is on screen, and the roster now holds the source day plus seven copies.
  await expect(page.getByText(plantDay(1), { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(8);
  const roster = await api<{ items: { date: string }[] }>('/api/v1/roster', token);
  expect(roster.items).toHaveLength(8);
  expect(roster.items.map((it) => it.date)).toContain(plantDay(7));
});
