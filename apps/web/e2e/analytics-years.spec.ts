import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { expect, test } from './test.js';
import { signIn } from './fixtures.js';

/**
 * ADR 0063: the one year picker in the shell header. A head opens the BD % and PM split screen, picks 2025, and the
 * address carries `?years=2025`, the figures are read for that span and the page's numbers change; Back returns to the
 * default read and a reload keeps the choice. The figures reply is stubbed per span with the frozen key (the
 * established seam); the server's span read is proved in `apps/server/test/analytics-served.test.ts`.
 */

const SCREEN = 'a1-bd-pm';
type KeyPage = { kpis: { label: string; value: string; sub: string }[] };
const KEY = JSON.parse(
  readFileSync(new URL(`../../../fixtures/answer-key/${SCREEN}.json`, import.meta.url), 'utf8'),
) as { pages: KeyPage[] };
const DEFAULT_VALUE = KEY.pages[0]!.kpis[0]!.value;
const SPAN_VALUE = '77.77%';

function replyFor(value: string): FiguresReply {
  const pages = KEY.pages.map((page, index) =>
    index === 0
      ? { ...page, kpis: page.kpis.map((k, at) => (at === 0 ? { ...k, value } : k)) }
      : page,
  );
  return {
    asOf: '2026-11-11',
    profile: {} as FiguresReply['profile'],
    excludedMachines: 0,
    rows: { machines: 125, moves: 0, tickets: 2, tasks: 0, reports: 5, people: 4 },
    years: [2025, 2026],
    figures: [
      {
        key: SCREEN,
        screen: SCREEN,
        owner: 40,
        status: 'ready',
        value: { ...KEY, pages },
        drill: { type: 'ticket', ids: [] },
      },
    ],
  };
}

/** The default read answers the key; a `?years=2025` read answers the key with its first number changed. */
async function stubFigures(page: Page): Promise<string[]> {
  const asked: string[] = [];
  await page.route('**/api/v1/analytics/figures**', (route) => {
    const years = new URL(route.request().url()).searchParams.get('years');
    asked.push(years ?? 'default');
    return route.fulfill({ json: replyFor(years === '2025' ? SPAN_VALUE : DEFAULT_VALUE) });
  });
  return asked;
}

test('picking a year puts it in the address, reads the figures for it, and Back and reload keep the choice', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const asked = await stubFigures(page);
  await signIn(page, 'head');
  await page.goto(`/analytics/breakdowns?screen=${SCREEN}`);
  await expect(page.getByText(DEFAULT_VALUE).first()).toBeVisible();
  const picker = page.getByLabel('Years of data', { exact: true });
  await expect(picker.locator('option')).toHaveText([
    'This year (trends use every year)',
    '2026',
    '2025',
    'All years',
  ]);

  await picker.selectOption('2025');
  await expect(page).toHaveURL(/[?&]years=2025(&|$)/);
  await expect(page.getByText(SPAN_VALUE).first()).toBeVisible();
  expect(asked).toContain('2025');

  await page.reload();
  await expect(page.getByLabel('Years of data', { exact: true })).toHaveValue('2025');
  await expect(page.getByText(SPAN_VALUE).first()).toBeVisible();

  await page.goBack();
  await expect(page).not.toHaveURL(/years=/);
  await expect(page.getByText(DEFAULT_VALUE).first()).toBeVisible();
});

test('a screen the years do not move says so once a year is picked', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubFigures(page);
  await signIn(page, 'head');
  await page.goto('/analytics/forecast-scorecard?screen=forecast-lab&years=2025');
  await expect(
    page.getByText('This page learns from every recorded year on purpose', { exact: false }),
  ).toBeVisible();
});
