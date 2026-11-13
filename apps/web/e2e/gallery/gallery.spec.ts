import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';

const SECTIONS = ['tokens', 'components', 'layout', 'status'] as const;
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
  await expect(pills).toHaveCount(31);
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
      if (accent === 'teal') await expect(html).toHaveAttribute('data-accent', 'teal');
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

test('accent switcher changes the accent token and leaving resets it', async ({ page }) => {
  await open(page, 'lang=gu');
  const teal = page.getByRole('button', { name: /Deep teal/ });
  await teal.click();
  await expect(teal).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/accent=teal/);
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'teal');
  await page.evaluate(() => {
    history.pushState({}, '', '/floor');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByTestId('gallery-root')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-accent');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('@planted a changed token fails the screenshot', async ({ page }, testInfo) => {
  expect(existsSync(testInfo.snapshotPath('status-en.png'))).toBe(true);
  await open(page, 'lang=en');
  await page.addStyleTag({ content: ':root{--color-danger:#000}' });
  await expect(
    expect(page.getByTestId('gallery-status')).toHaveScreenshot('status-en.png'),
  ).rejects.toThrow();
});
