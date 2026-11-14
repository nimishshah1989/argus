import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';

const SECTIONS = ['tokens', 'components', 'layout', 'status', 'shell', 'floor'] as const;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`/gallery?${query}`);
  await page.getByTestId('gallery-root').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

test('gallery en: every section matches its baseline at 360 px', async ({ page }) => {
  await open(page, 'lang=en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const pills = page.getByTestId('gallery-status').locator('[data-status]');
  await expect(pills).toHaveCount(36);
  for (const pill of await pills.all()) {
    await expect(pill.locator('svg')).toHaveCount(1);
    await expect(pill).not.toHaveText('');
  }
  for (const name of SECTIONS)
    await expect(page.getByTestId(`gallery-${name}`)).toHaveScreenshot(`${name}-en.png`);
});

test('gallery gu: placeholder Gujarati renders and matches its baseline', async ({ page }) => {
  await open(page, 'lang=gu');
  await expect(page.locator('html')).toHaveAttribute('lang', 'gu');
  await expect(page.getByText('Gujarati placeholder')).toBeVisible();
  await expect(page.getByTestId('gallery-gu-specimen')).toContainText('ક');
  await expect(page.getByTestId('gallery-gu-specimen')).toContainText('૯');
  await expect(page.getByTestId('gallery-primary-sample')).toHaveText(/^ક ખ ગ ·/);
  for (const name of SECTIONS)
    await expect(page.getByTestId(`gallery-${name}`)).toHaveScreenshot(`${name}-gu.png`);
});

for (const lang of ['en', 'gu']) {
  test(`gallery ${lang}: the open sheet matches its baseline`, async ({ page }) => {
    await open(page, `lang=${lang}`);
    await page.getByTestId('gallery-sheet-open').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(lang === 'en' ? 'Sheet title' : 'ક ખ ગ · Sheet title');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await expect(page).toHaveScreenshot(`sheet-open-${lang}.png`);
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(axe.violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  for (const accent of ['blue', 'teal']) {
    test(`gallery ${lang} ${accent}: axe clean`, async ({ page }) => {
      await open(page, `lang=${lang}&accent=${accent}`);
      const html = page.locator('html');
      if (accent === 'blue') await expect(html).toHaveAttribute('data-accent', 'blue');
      else await expect(html).not.toHaveAttribute('data-accent');
      await expect(page.getByTestId('gallery-primary-sample')).toHaveCSS(
        'background-color',
        accent === 'teal' ? 'rgb(15, 118, 110)' : 'rgb(10, 102, 194)',
      );
      const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(axe.violations).toEqual([]);
    });
  }
}

for (const lang of ['en', 'gu']) {
  test(`gallery ${lang} dark: the dark accent, every status chip, axe clean`, async ({ page }) => {
    await open(page, `lang=${lang}&theme=dark`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const primary = page.getByTestId('gallery-primary-sample');
    await expect(primary).toHaveCSS('background-color', 'rgb(20, 184, 166)');
    await expect(primary).toHaveCSS('color', 'rgb(4, 32, 29)');
    const pills = page.getByTestId('gallery-status').locator('[data-status]');
    await expect(pills).toHaveCount(36);
    for (const pill of await pills.all()) await expect(pill.locator('svg')).toHaveCount(1);
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(axe.violations).toEqual([]);
    for (const name of SECTIONS)
      await expect(page.getByTestId(`gallery-${name}`)).toHaveScreenshot(
        `${name}-${lang}-dark.png`,
      );
  });
}

test('@planted a status ink below 4.5:1 on its tint fails axe', async ({ page }) => {
  await open(page, 'lang=en');
  await page.addStyleTag({
    content: ':root{--color-danger-ink:#dc2626;--color-muted-ink:#8e8e93}',
  });
  const axe = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .include('[data-testid="gallery-status"]')
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual(['color-contrast']);
});

test('accent switcher changes the accent token and leaving resets it', async ({ page }) => {
  await open(page, 'lang=gu');
  await expect(page.locator('html')).not.toHaveAttribute('data-accent');
  const blue = page.getByRole('button', { name: /Blue/ });
  await blue.click();
  await expect(blue).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/accent=blue/);
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue');
  await page.evaluate(() => {
    history.pushState({}, '', '/floor');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByTestId('gallery-root')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-accent');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

for (const lang of ['en', 'gu']) {
  test(`patterns ${lang}: queue and detail show every state at 360 px, axe clean`, async ({
    page,
  }) => {
    await open(page, `lang=${lang}`);
    const at = (id: string) => page.getByTestId(id);
    await expect(at('gallery-queue-ready').locator('li')).toHaveCount(3);
    await expect(
      at('gallery-queue-ready').getByRole('button', { name: /Load more/ }),
    ).toBeVisible();
    for (const id of ['gallery-queue-loading', 'gallery-detail-loading'])
      await expect(at(id)).toContainText('Loading…');
    await expect(at('gallery-queue-empty')).toContainText('No open tickets.');
    await expect(at('gallery-detail-empty')).toContainText('This ticket no longer exists.');
    for (const id of ['gallery-queue-error', 'gallery-detail-error']) {
      await expect(at(id).getByRole('alert')).toContainText('Could not load. Try again.');
      await expect(at(id).getByRole('button', { name: /Try again/ })).toBeVisible();
    }
    for (const id of ['gallery-queue-offline', 'gallery-detail-offline']) {
      await expect(at(id)).toContainText('You are offline. This will load when you reconnect.');
      await expect(at(id).getByTestId('sync-status')).toHaveText(/Offline/);
    }
    await expect(at('gallery-detail-ready')).toContainText('CNC-07');
    await expect(at('gallery-detail-ready')).toContainText('Reported from the floor');
    await expect(at('gallery-queue')).toHaveScreenshot(`queue-${lang}.png`);
    await expect(at('gallery-detail')).toHaveScreenshot(`detail-${lang}.png`);
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(axe.violations).toEqual([]);
  });

  for (const state of ['loading', 'empty', 'error', 'offline']) {
    test(`form sheet ${state} ${lang}`, async ({ page }) => {
      await open(page, `lang=${lang}`);
      await page.getByTestId(`gallery-form-open-${state}`).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      const submit = dialog.locator('button[type="submit"]');
      if (state === 'loading') {
        await expect(submit).toHaveText(/Sending…/);
        await expect(submit).toBeDisabled();
      }
      if (state === 'error')
        await expect(dialog.getByRole('alert')).toContainText(
          'The ticket changed while you were away.',
        );
      if (state === 'offline')
        await expect(dialog).toContainText('You are offline. This will send when you reconnect.');
      if (state === 'empty') await expect(submit).toBeDisabled();
      await expect(page).toHaveScreenshot(`form-${state}-${lang}.png`);
      const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(axe.violations).toEqual([]);
      if (state === 'empty') {
        await dialog.getByLabel(/Note/).fill('Belt replaced');
        await expect(submit).toBeEnabled();
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  }
}

test('patterns: the queue pages by cursor', async ({ page }) => {
  await open(page, 'lang=en');
  const queue = page.getByTestId('gallery-queue-ready');
  await queue.getByRole('button', { name: 'Load more' }).click();
  await expect(queue.locator('li')).toHaveCount(5);
  await expect(queue.locator('li').last()).toContainText('BD-0105');
  await expect(queue.getByRole('button', { name: 'Load more' })).toHaveCount(0);
});

test('sync status: online, offline, sending, then draft after a 409 replay', async ({ page }) => {
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/v1/tickets/*/close', async (route) => {
    await released;
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: '{"error":{"code":"conflict","message":"Ticket changed"}}',
    });
  });
  await open(page, 'lang=en');
  const pill = page.getByTestId('gallery-queue-ready').getByTestId('sync-status');
  await expect(pill).toHaveText(/Online/);
  await page.evaluate(
    (u) =>
      import(/* @vite-ignore */ u).then((m) => {
        (window as unknown as { outbox: unknown }).outbox = m;
      }),
    '/src/offline/outbox.ts',
  );
  await page.context().setOffline(true);
  await expect(pill).toHaveText(/Offline/);
  await page.evaluate(() =>
    (window as unknown as { outbox: { enqueue: (e: unknown) => Promise<unknown> } }).outbox.enqueue(
      {
        action: 'close',
        ticketId: 'gallery-1',
        ref: 'BD-0101',
        body: { personId: 'p-1', kind: 'done' },
        idempotencyKey: 'gallery-key-1',
      },
    ),
  );
  await page.context().setOffline(false);
  await expect(pill).toHaveText(/Sending/);
  release();
  await expect(pill).toHaveText(/Draft/, { timeout: 10_000 });
  const result = await page.evaluate(async () => {
    const outbox = (
      window as unknown as {
        outbox: {
          listDrafts: () => Promise<{ reason: string; ref: string }[]>;
          queueLength: () => Promise<number>;
        };
      }
    ).outbox;
    return { drafts: await outbox.listDrafts(), queued: await outbox.queueLength() };
  });
  expect(result.drafts).toHaveLength(1);
  expect(result.drafts[0]).toMatchObject({ reason: 'Ticket changed', ref: 'BD-0101' });
  expect(result.queued).toBe(0);
});

test('@planted a changed token fails the screenshot', async ({ page }, testInfo) => {
  expect(existsSync(testInfo.snapshotPath('status-en.png'))).toBe(true);
  await open(page, 'lang=en');
  await page.addStyleTag({ content: ':root{--color-danger-ink:#000}' });
  await expect(
    expect(page.getByTestId('gallery-status')).toHaveScreenshot('status-en.png'),
  ).rejects.toThrow();
});

test('screen frame: header sync pills, banners, both tab bars and loading shapes', async ({
  page,
}) => {
  await open(page, 'lang=en');
  const shell = page.getByTestId('gallery-shell');
  for (const word of ['Online', 'Offline', 'Sending', 'Draft'])
    await expect(shell.locator('header').filter({ hasText: word })).toHaveCount(1);
  await expect(shell.getByRole('alert')).toContainText('Could not send, try again.');
  await expect(shell.getByRole('status').filter({ hasText: 'Needs attention' })).toBeVisible();
  const desk = shell.getByRole('navigation', { name: 'Desk' });
  await expect(desk.getByRole('link')).toHaveText(['7Open', 'Mine', 'Team', 'Report', 'Live']);
  await expect(desk.getByRole('link', { name: /Open/ })).toHaveAttribute('aria-current', 'page');
  const floor = shell.getByRole('navigation', { name: 'Floor' });
  await expect(floor.getByRole('link')).toHaveText(['Report', 'My complaints']);
  for (const link of await floor.getByRole('link').all())
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  await expect(shell.getByRole('status').filter({ hasText: 'Loading…' })).toBeVisible();
});
