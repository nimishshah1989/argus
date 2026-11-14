import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { apiFetch, apiLogin, signIn } from './fixtures.js';

/** A phone with an update installed and waiting: a stand-in registration that records what the page asks of it. */
async function withWaitingUpdate(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const asked: unknown[] = [];
    (window as unknown as { asked: unknown[] }).asked = asked;
    const registration = {
      waiting: { postMessage: (message: unknown) => asked.push(message) },
      installing: null,
      addEventListener: () => undefined,
    };
    const worker = navigator.serviceWorker;
    Object.defineProperty(worker, 'getRegistration', {
      value: () => Promise.resolve(registration),
    });
    Object.defineProperty(worker, 'controller', { value: {} });
  });
}

/** The instant on 14 Nov 2026 at which the plant's clock reads `hhmm`. */
function instantWhenPlantReads(hhmm: string, timeZone: string): Date {
  const base = Date.parse('2026-11-14T00:00:00Z');
  for (let minute = 0; minute < 2 * 1440; minute += 1) {
    const at = new Date(base + minute * 60_000);
    const read = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone,
    }).format(at);
    if (read === hhmm) return at;
  }
  throw new Error(`no instant reads ${hhmm}`);
}

let zone = '';

/** Desktop only, and one API login for the whole file: the API's login rate limit is shared by every spec (see actions.spec.ts). */
test.beforeAll(async () => {
  const token = await apiLogin('asha');
  const res = await apiFetch('/api/v1/config', { headers: { authorization: `Bearer ${token}` } });
  zone = ((await res.json()) as { timeZone: string }).timeZone;
});

// eslint-disable-next-line no-empty-pattern -- Playwright needs the fixtures object before testInfo
test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium',
    'nothing here depends on the phone or the language',
  );
});

test('floor and desk install as two apps: each address offers its own app', async ({ page }) => {
  // Signed in, as someone installing the app is: a signed-out visitor is sent to the sign-in page first.
  await signIn(page, 'asha');
  const manifests: Record<string, { id: string; start_url: string }> = {};
  for (const path of ['/floor', '/desk']) {
    await page.goto(path);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(await page.locator('link[rel="manifest"]').count()).toBe(1);
    manifests[path] = await page.evaluate(
      async (url) => (await fetch(url)).json() as Promise<{ id: string; start_url: string }>,
      href!,
    );
  }
  expect(manifests['/floor']).toMatchObject({ id: '/floor', start_url: '/floor' });
  expect(manifests['/desk']).toMatchObject({ id: '/desk', start_url: '/desk' });
});

test('a waiting update shows a banner, and Update now asks the new version to take over', async ({
  page,
}) => {
  await page.clock.setFixedTime(instantWhenPlantReads('12:00', zone));
  await withWaitingUpdate(page);
  await signIn(page, 'asha');
  await page.goto('/desk');
  await expect(page.getByText('A new version is ready')).toBeVisible();
  await page.getByRole('button', { name: 'Update now' }).click();
  expect(await page.evaluate(() => (window as unknown as { asked: unknown[] }).asked)).toEqual([
    { type: 'SKIP_WAITING' },
  ]);
});

test('the update banner waits out the shift changeover', async ({ page }) => {
  await page.clock.setFixedTime(instantWhenPlantReads('00:05', zone));
  await withWaitingUpdate(page);
  await signIn(page, 'asha');
  await page.goto('/desk');
  await expect(
    page.getByRole('heading', { name: 'Open' }).or(page.getByRole('tablist')),
  ).toBeVisible();
  await expect(page.getByText('A new version is ready')).toHaveCount(0);
});

const asked = (page: Page) =>
  page.evaluate(() => (window as unknown as { asked: unknown[] }).asked);

test('the wall TV updates itself, but not during the shift changeover', async ({ page }) => {
  await withWaitingUpdate(page);
  await signIn(page, 'asha');
  await page.clock.setFixedTime(instantWhenPlantReads('00:05', zone));
  await page.goto('/desk/board?kiosk=1');
  await expect(page.getByTestId('count-running')).toBeAttached();
  expect(await asked(page)).toEqual([]);
  await page.clock.setFixedTime(instantWhenPlantReads('12:00', zone));
  await page.goto('/desk/board?kiosk=1');
  await expect.poll(() => asked(page)).toEqual([{ type: 'SKIP_WAITING' }]);
  await expect(page.getByText('A new version is ready')).toHaveCount(0);
});
