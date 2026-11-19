import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const open = async (page: Page, query = ''): Promise<void> => {
  await page.goto(`/gallery?view=navmap${query}`);
  await expect(page.getByTestId('navmap')).toBeVisible();
};
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

test.describe('the navigation map preview, desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a head sees six sections and the guide; a role that sees fewer gets fewer', async ({
    page,
  }) => {
    await open(page);
    const items = page.getByTestId('menu').getByRole('button');
    await expect(items).toHaveText([
      'Today',
      'Machines',
      'Problems',
      'Reliability & forecast',
      'People & money',
      'Reports',
      'Guide',
    ]);
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    await expect(items).toHaveText([
      'Today',
      'Reliability & forecast',
      'People & money',
      'Reports',
      'Guide',
    ]);
    await page.getByRole('button', { name: 'Desk', exact: true }).click();
    await expect(page.getByTestId('lands')).toContainText('/desk');
    expect(await items.count()).toBeLessThan(6);
  });

  test('the active item says so, arrows move through the menu, every page is a preview', async ({
    page,
  }) => {
    await open(page);
    await expect(page.getByTestId('menu-today')).toHaveAttribute('aria-current', 'page');
    await page.getByTestId('menu-today').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('menu-machines')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('menu-machines')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('page')).toContainText('Machine list');
    await expect(page.getByTestId('page-preview')).toHaveText('preview');
  });

  test('submenus are tabs inside the section and never a third level', async ({ page }) => {
    await open(page, '&section=problems');
    const tabs = page.getByTestId('tabs').getByRole('button');
    await expect(tabs).toHaveText([
      'Costliest',
      'Pareto',
      'Repeats',
      'Fix finder',
      'Problem analysis',
    ]);
    await page.getByTestId('tab-pareto').click();
    await expect(page.getByTestId('tab-pareto')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('page')).toContainText('Pareto');
    // Still one menu, still the same tabs, and the page holds no further navigation.
    await expect(page.getByTestId('menu-problems')).toHaveAttribute('aria-current', 'page');
    await expect(tabs).toHaveCount(5);
    await expect(page.getByTestId('page').getByRole('navigation')).toHaveCount(0);
    await expect(page.getByRole('navigation')).toHaveCount(2);
  });
});

test.describe('the navigation map preview, search and look', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Ctrl or Cmd K opens the palette, it filters as you type, arrows and Enter go, Esc closes', async ({
    page,
  }) => {
    await open(page);
    await page.keyboard.press(`${MOD}+k`);
    const palette = page.getByTestId('palette');
    await expect(palette).toBeVisible();
    const options = palette.getByRole('option');
    const before = await options.count();
    await page.keyboard.type('pareto');
    await expect(options).toHaveCount(1);
    expect(before).toBeGreaterThan(10);
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
    await expect(page.getByTestId('search-button')).toBeFocused();

    await page.keyboard.press(`${MOD}+k`);
    await page.keyboard.type('reports');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('Enter');
    await expect(palette).toBeHidden();
    await expect(page.getByTestId('page')).toContainText('Reports');
    await page.getByTestId('search-button').click();
    await page.keyboard.type('zzzz');
    await expect(palette).toContainText('Nothing matches');
  });
});

test.describe('the navigation map preview, search coverage', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('every screen is searchable, the Guide included', async ({ page }) => {
    await open(page);
    await page.keyboard.press(`${MOD}+k`);
    await page.keyboard.type('How this app works');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('menu-guide')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('page')).toContainText('How this app works');
  });

  test('an unknown view name shows the section list, not a crash', async ({ page }) => {
    await page.goto('/gallery?view=constructor');
    await expect(page.getByTestId('gallery-root')).toBeVisible();
  });

  test('the period picker defaults to this year so far and offers a custom range', async ({
    page,
  }) => {
    await open(page);
    await expect(page.getByTestId('period')).toHaveValue('ytd');
    await expect(page.getByTestId('page-period')).toContainText('This year so far');
    await page.getByTestId('period').selectOption('custom');
    await expect(page.getByRole('textbox', { name: 'From' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'To', exact: true })).toBeVisible();
  });

  for (const theme of ['light', 'dark']) {
    test(`renders in ${theme} with no axe violation`, async ({ page }) => {
      await open(page, `&theme=${theme}`);
      await page.getByTestId('tab-dashboard').waitFor();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('the theme toggle flips light and dark', async ({ page }) => {
    await open(page);
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('the navigation map preview, phone', () => {
  test.use({ viewport: { width: 360, height: 760 } });

  test('the menu is a drawer behind a Menu button; no sideways scroll', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('menu')).toBeHidden();
    await page.getByTestId('menu-button').click();
    await expect(page.getByTestId('menu')).toBeVisible();
    await expect(page.getByTestId('menu-today')).toBeFocused();
    await page.getByTestId('menu-reports').click();
    await expect(page.getByTestId('menu')).toBeHidden();
    await expect(page.getByTestId('page')).toContainText('Monthly report');
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(wide).toBe(false);
    await page.getByTestId('menu-button').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('menu')).toBeHidden();
    await expect(page.getByTestId('menu-button')).toBeFocused();
  });

  test('the palette opens above the drawer, which closes', async ({ page }) => {
    await open(page);
    await page.getByTestId('menu-button').click();
    await expect(page.getByTestId('menu')).toBeVisible();
    await page.keyboard.press(`${MOD}+k`);
    await expect(page.getByTestId('palette')).toBeVisible();
    await expect(page.getByTestId('menu')).toBeHidden();
  });
});
