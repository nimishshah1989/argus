import type { Page } from '@playwright/test';
import { expect, test } from './test.js';
import { scopedId, signIn } from './fixtures.js';

/**
 * Ticket 21 goal 2 (v3.signin.03, slice 3 T2; Nimish 14 Nov: the floor and the desk pick from the people
 * list). A shared phone asks who is using it once, after sign-in; the server's "choose who is acting" and
 * "must change password" answers reopen their step from anywhere.
 */
async function signInShared(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('cell-phone');
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('a shared phone asks who is using it once, then the floor works as that person', async ({
  page,
}) => {
  await signInShared(page);
  await expect(page.getByRole('heading', { name: 'Who is using this phone?' })).toBeVisible();
  await expect(page.getByText('Shared phone', { exact: false })).toBeVisible();
  const cont = page.getByRole('button', { name: 'Continue', exact: true });
  await expect(cont).toBeDisabled();
  // A disabled primary must not look like a live one (T2 greys it out).
  const fill = () => cont.evaluate((el) => getComputedStyle(el).backgroundColor);
  const greyed = await fill();
  await page.getByLabel('Your name').selectOption({ label: 'Omi' });
  await expect(cont).toBeEnabled();
  expect(await fill()).not.toBe(greyed);
  await cont.click();
  await expect(page.getByRole('heading', { name: 'Report a problem' })).toBeVisible();

  await page.getByRole('button', { name: /^Other work \(not a machine\)/ }).click();
  await expect(page.getByText('Reporting as Omi')).toBeVisible();
});

test('the server asking again who is acting reopens the step', async ({ page }) => {
  await signIn(page, 'op');
  await page.route(/\/api\/v1\/state(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'choose_acting_person',
          message: 'Choose who is using this phone to continue',
        },
      }),
    }),
  );
  await page.goto('/floor');
  await expect(page.getByRole('heading', { name: 'Who is using this phone?' })).toBeVisible();
});

test('a login that must change its password goes to that step and checks the two new ones match', async ({
  page,
}) => {
  await signIn(page, 'op');
  await page.route(/\/api\/v1\/state(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'must_change_password', message: 'Change your password to continue' },
      }),
    }),
  );
  await page.goto('/floor');
  await expect(page.getByRole('heading', { name: 'Change your password' })).toBeVisible();
  await page.getByLabel('Current password').fill('correct-horse-battery');
  await page.getByLabel('New password (at least 8 characters)').fill('a-new-long-phrase');
  await page.getByLabel('New password again').fill('a-new-long-phrasf');
  await expect(page.getByText('The two new passwords are not the same')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save password', exact: true })).toBeDisabled();
});

/** Interrogate review of #225: the step order, the outbox and who a queued command belongs to. */
const CELL_PHONE_LOGIN = scopedId('10000000-0000-0000-0000-000000000010');
const OMI = scopedId('10000000-0000-0000-0000-00000000000b');

interface Who {
  loginId: string;
  actingPersonId: string;
  name: string;
}

/** Puts one queued close in the phone's outbox, as if made offline earlier by `who`. */
async function seedQueuedClose(page: Page, who: Who): Promise<void> {
  await page.evaluate(
    (entry) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('uptimo-offline', 1);
        open.onupgradeneeded = () => {
          open.result.createObjectStore('queue', { keyPath: 'id' });
          open.result.createObjectStore('drafts', { keyPath: 'id' });
        };
        open.onsuccess = () => {
          const tx = open.result.transaction('queue', 'readwrite');
          tx.objectStore('queue').put(entry);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    {
      id: 'queued-close-1',
      action: 'close',
      ticketId: '00000000-0000-4000-8000-000000000001',
      ref: 'BD-9999',
      body: { personId: who.actingPersonId, kind: 'done' },
      idempotencyKey: '00000000-0000-4000-8000-000000000002',
      at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      who,
    },
  );
}

const queued = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open('uptimo-offline', 1);
        open.onsuccess = () => {
          const count = open.result.transaction('queue').objectStore('queue').count();
          count.onsuccess = () => resolve(count.result);
        };
      }),
  );

test('a temporary password on a shared phone comes before who is acting, without a reload loop', async ({
  page,
}) => {
  const seen: string[] = [];
  page.on('framenavigated', (frame) => seen.push(new URL(frame.url()).pathname));
  await page.route(/\/api\/v1\/config(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'must_change_password', message: 'x' } }),
    }),
  );
  await page.goto('/login');
  await seedQueuedClose(page, { loginId: CELL_PHONE_LOGIN, actingPersonId: OMI, name: 'Omi' });
  await page.getByLabel('Username', { exact: true }).fill('cell-phone');
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Change your password' })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/password$/);
  expect(seen).not.toContain('/who');
  expect(await queued(page)).toBe(1);
});

test('a command queued by someone else on this phone is held, named, and never sent as the next person', async ({
  page,
}) => {
  const sent: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/close$/.test(request.url())) sent.push(request.url());
  });
  await page.goto('/login');
  await seedQueuedClose(page, {
    loginId: 'another-login',
    actingPersonId: 'another',
    name: 'Asha',
  });
  await signIn(page, 'bina');
  await page.goto('/desk');
  await expect(page.getByText('Not sent: queued by Asha')).toBeVisible();
  // Held work is not on its way: the sync pill must not say Sending (review of PR 225, gallery run).
  await page.waitForTimeout(3500);
  await expect(page.getByTestId('sync-status').first()).not.toHaveText(/Sending/);
  expect(sent).toEqual([]);
  expect(await queued(page)).toBe(1);
});

test('choosing who is using the phone sends what that person queued earlier', async ({ page }) => {
  await page.goto('/login');
  await seedQueuedClose(page, { loginId: CELL_PHONE_LOGIN, actingPersonId: OMI, name: 'Omi' });
  await signInShared(page);
  await expect(page.getByRole('heading', { name: 'Who is using this phone?' })).toBeVisible();
  await page.getByLabel('Your name').selectOption({ label: 'Omi' });
  const replay = page.waitForRequest((r) => r.method() === 'POST' && /\/close$/.test(r.url()));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await replay;
});

test('a wrong current password keeps the phone signed in; the "other phones" line shows only after saving', async ({
  page,
}) => {
  await signIn(page, 'op');
  await page.route(/\/api\/v1\/state(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'must_change_password', message: 'x' } }),
    }),
  );
  await page.goto('/floor');
  await expect(page.getByRole('heading', { name: 'Change your password' })).toBeVisible();
  await expect(page.getByText('Your other phones and screens are signed out.')).toHaveCount(0);
  await page.getByLabel('Current password').fill('not-my-password');
  await page.getByLabel('New password (at least 8 characters)').fill('a-new-long-phrase');
  await page.getByLabel('New password again').fill('a-new-long-phrase');
  await page.getByRole('button', { name: 'Save password', exact: true }).click();
  await expect(page.getByText('Your current password is not right.')).toBeVisible();
  await expect(page).toHaveURL(/\/password$/);
  expect(await page.evaluate(() => localStorage.getItem('uptimo_token'))).not.toBeNull();

  await page.route(/\/api\/v1\/auth\/password$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
  );
  await page.getByLabel('Current password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Save password', exact: true }).click();
  await expect(page.getByText('Your other phones and screens are signed out.')).toBeVisible();
});

test('a wrong current password answered 422 for "old" also keeps the phone signed in', async ({
  page,
}) => {
  // The app must not log this as a failure; the browser's own "Failed to load resource" lines are not the app's.
  const logged: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text()))
      logged.push(message.text());
  });
  await signIn(page, 'op');
  await page.route(/\/api\/v1\/state(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'must_change_password', message: 'x' } }),
    }),
  );
  await page.goto('/floor');
  await expect(page.getByRole('heading', { name: 'Change your password' })).toBeVisible();
  await page.route(/\/api\/v1\/auth\/password$/, (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'validation', message: 'Current password is incorrect', field: 'old' },
      }),
    }),
  );
  await page.getByLabel('Current password').fill('not-my-password');
  await page.getByLabel('New password (at least 8 characters)').fill('a-new-long-phrase');
  await page.getByLabel('New password again').fill('a-new-long-phrase');
  await page.getByRole('button', { name: 'Save password', exact: true }).click();
  await expect(page.getByText('Your current password is not right.')).toBeVisible();
  await expect(page).toHaveURL(/\/password$/);
  expect(await page.evaluate(() => localStorage.getItem('uptimo_token'))).not.toBeNull();
  expect(logged).toEqual([]);
});
