import type { Page, Request } from '@playwright/test';
import { expect, test } from './test.js';
import { E2E_PASSWORD, signIn } from './fixtures.js';

/**
 * A phone with no valid session goes to sign-in instead of waiting on "Loading…" (staging bug, 14 Nov),
 * a load that fails for another reason says so with "Try again", and a sign-in that fails says what
 * happened instead of one generic message.
 */
const SIGNED_IN_ONLY = ['/floor', '/desk', '/desk/board', '/who', '/password'];

for (const path of SIGNED_IN_ONLY) {
  test(`a phone that never signed in opens ${path} and lands on sign-in, quietly`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByText('You were signed out')).toHaveCount(0);
  });
}

test('an expired session on the desk lands on sign-in and says it ended', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('uptimo_token', 'expired-long-ago');
  });
  await page.goto('/desk');
  await expect(page).toHaveURL(/\/login\?signedOut=1$/);
  await expect(page.getByText('Your session has ended. Sign in again.')).toBeVisible();
});

test('a signed-out phone stops asking the server once it is on sign-in', async ({ page }) => {
  const calls: Request[] = [];
  page.on('request', (request) => {
    if (/\/api\/v1\/(config|state|auth\/me)(\?|$)/.test(request.url())) calls.push(request);
  });
  await page.goto('/floor');
  await expect(page).toHaveURL(/\/login$/);
  const settled = calls.length;
  await page.waitForTimeout(4000);
  expect(calls.length).toBe(settled);
  expect(settled).toBeLessThanOrEqual(6);
});

test('a load that fails shows why and Try again, never Loading forever', async ({ page }) => {
  await signIn(page, 'op');
  const broken = (route: import('@playwright/test').Route) =>
    route.fulfill({ status: 502, contentType: 'text/html', body: 'Bad Gateway' });
  await page.route(/\/api\/v1\/config(?:\?.*)?$/, broken);
  await page.goto('/floor');
  await expect(page.getByText('Could not load. Try again.')).toBeVisible();
  await page.unroute(/\/api\/v1\/config(?:\?.*)?$/, broken);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Which machine?' })).toBeVisible();
});

async function signInAttempt(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('op');
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('sign-in that cannot reach the server says so and logs the real error', async ({ page }) => {
  const logged: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') logged.push(message.text());
  });
  await page.route(/\/api\/v1\/auth\/login$/, (route) => route.abort('connectionreset'));
  await signInAttempt(page);
  await expect(page.getByRole('alert')).toContainText('Cannot reach the server');
  await expect(page.getByText('Could not send. Try again.')).toHaveCount(0);
  expect(logged.join('\n')).toMatch(/sign-in.*(TypeError|Failed to fetch|network)/is);
});

test('sign-in the server could not answer says the server had a problem, not wrong password', async ({
  page,
}) => {
  const logged: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') logged.push(message.text());
  });
  await page.route(/\/api\/v1\/auth\/login$/, (route) =>
    route.fulfill({ status: 502, contentType: 'text/html', body: 'Bad Gateway' }),
  );
  await signInAttempt(page);
  await expect(page.getByRole('alert')).toContainText('The server had a problem');
  await expect(page.getByText('Sign-in failed')).toHaveCount(0);
  expect(logged.join('\n')).toContain('502');
});

test('when several calls are refused at once the sign-in screen still says the session ended', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('uptimo_token', 'expired-long-ago');
  });
  const refused = (delay: number) => async (route: import('@playwright/test').Route) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{"error":{"code":"unauthenticated","message":"ended"}}',
    });
  };
  // The first refusal starts the move to sign-in; the sign-in page is slow to arrive, so the later
  // refusals land while it is still on its way and must not send it somewhere else.
  await page.route(/\/api\/v1\/config(?:\?.*)?$/, refused(0));
  await page.route(/\/api\/v1\/state(?:\?.*)?$/, refused(250));
  await page.route(/\/api\/v1\/auth\/me(?:\?.*)?$/, refused(400));
  await page.route(/\/login\?signedOut=1$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });
  await page.goto('/floor');
  await expect(page).toHaveURL(/\/login\?signedOut=1$/, { timeout: 15_000 });
  await expect(page.getByText('Your session has ended. Sign in again.')).toBeVisible();
});
