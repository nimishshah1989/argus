import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const GROUPS = [
  'Foundations',
  'Layout',
  'Data display',
  'Inputs and forms',
  'Feedback and states',
  'Domain pieces',
];

for (const theme of ['light', 'dark']) {
  test(`kit index (${theme}): every group of the v2 kit is listed, the screens are linked, axe is clean`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/gallery?theme=${theme}`);
    await expect(page.getByTestId('gallery-root')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'The v2 kit' })).toBeVisible();
    for (const group of GROUPS)
      await expect(page.getByRole('heading', { level: 2, name: group, exact: true })).toBeVisible();
    await expect(page.getByText('data-table.tsx', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'v2-compare', exact: true })).toHaveAttribute(
      'href',
      '/gallery?view=v2-compare',
    );
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(axe.violations).toEqual([]);
  });
}
