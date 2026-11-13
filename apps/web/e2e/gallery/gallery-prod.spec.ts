import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS = join(process.cwd(), 'apps/web/dist/assets');
const read = (ext: string): string[] =>
  readdirSync(ASSETS)
    .filter((name) => name.endsWith(ext))
    .map((name) => readFileSync(join(ASSETS, name), 'utf8'));

test('production build answers 404 on /gallery', async ({ page }) => {
  await page.goto('http://127.0.0.1:3101/gallery');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/gallery');
  await expect(page.getByTestId('gallery-root')).toHaveCount(0);
  expect(read('.js').some((js) => js.includes('gallery-root'))).toBe(false);
  expect(read('.css').some((css) => css.includes('--color-stopped'))).toBe(true);
});
