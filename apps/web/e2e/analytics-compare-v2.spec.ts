import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { MACHINES, signIn } from './fixtures.js';

/**
 * CMP-5 (ticket 588, ADR 0021): v2 Compare at v1's address. The compare reply is stubbed with the frozen 11 November
 * page and two invented years, so the journey proves the screen (picker in the URL, the six tables, money for heads
 * only, the Team Focus link), not the engine.
 */

const PAGE = JSON.parse(
  readFileSync(new URL('../../../fixtures/answer-key/compare.json', import.meta.url), 'utf8'),
) as unknown;
const [first, second] = MACHINES;
const year = (code: string, machineId: string, hours: number) => ({
  machineId,
  code,
  category: 'Vertical Machining Center',
  cell: 'Cell 1',
  age: 6,
  count: 4,
  hours,
  plannedHours: 5000,
  causes: [{ code: 'ATC', count: 4, hours }],
  weekly: Array.from({ length: 12 }, () => 1),
  last: { count: 2, hours: 2 },
});
const replyFor = (rate: number | null) => ({
  asOf: '2026-11-11',
  pair: { a: 'VC-28', b: 'VC-22' },
  options: ['VC-28', 'VC-22', 'VC-18'],
  figure: {
    key: 'compare',
    screen: 'compare',
    owner: 43,
    status: 'ready',
    value: PAGE,
    drill: { type: 'machine', ids: [first!.id, second!.id] },
  },
  years: [year('VC-28', first!.id, 12), year('VC-22', second!.id, 4)],
  rate,
});

async function stubCompare(page: Page, rate: number | null): Promise<string[]> {
  const asked: string[] = [];
  await page.route('**/api/v1/analytics/compare**', (route) => {
    asked.push(route.request().url());
    return route.fulfill({ json: replyFor(rate) });
  });
  return asked;
}

test('a head compares two machines, picks another, reads the six tables and opens Team Focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const asked = await stubCompare(page, 3329);
  await signIn(page, 'head');
  await page.goto('/analytics/machines?screen=compare');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Compare machines and health score' }),
  ).toBeVisible();
  await expect(page.getByText('3.0× more hours', { exact: true })).toBeVisible();
  await expect(page.getByText('Extra money lost', { exact: true })).toBeVisible();
  for (const title of ['Health scorecard (0–10, adjusted for age)', 'Health checkup', 'By shift'])
    await expect(page.getByRole('region', { name: title, exact: true })).toBeVisible();
  await page
    .getByRole('group', { name: 'Second machine', exact: true })
    .getByRole('button', { name: 'VC-18', exact: true })
    .click();
  await expect(page).toHaveURL(/[?&]a=VC-28&b=VC-18/);
  await expect.poll(() => asked.at(-1)).toMatch(/a=VC-28&b=VC-18$/);
  await page.getByRole('button', { name: 'Open Team Focus', exact: true }).click();
  await expect(page).toHaveURL(/\/analytics\/today\?screen=team-focus$/);
});

test('a supervisor sees the comparison with no money on it', async ({ page }) => {
  await stubCompare(page, null);
  await signIn(page, 'sup');
  await page.goto('/analytics/machines?screen=compare');
  await expect(page.getByText('3.0× more hours', { exact: true })).toBeVisible();
  await expect(page.getByText('Extra money lost', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Money lost', { exact: true })).toHaveCount(0);
});
