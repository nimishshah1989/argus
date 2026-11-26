import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './test.js';
import { signIn } from './fixtures.js';
import { openShowDetail } from './show-detail.js';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * The v2 Dashboard on the real server, the single smoke: it loads at Today's address with the engine's own figures,
 * a figure opens the rows behind it in the drawer, Back closes it, and the page passes axe in light and dark.
 * The figure-by-figure and needs-now assertions live in analytics.spec.ts and the adapter's unit test.
 */
for (const scheme of ['light', 'dark'] as const) {
  test(`the Dashboard loads, opens the rows behind a figure, and passes axe in ${scheme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: scheme });
    await signIn(page, 'head');
    await expect(page).toHaveURL(/\/analytics\/today$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Dashboard', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What needs you now' })).toBeVisible();
    // Figures past the fourth fold sit under "Show detail" (ADR 0041).
    await openShowDetail(page);
    const machines = page.getByRole('region', { name: 'Total machines', exact: true });
    await expect(machines).toBeVisible();

    await expect(
      machines.getByRole('button', { name: /Show the rows behind Total machines/ }),
    ).toBeVisible();
    // ADR 0060: the whole card is the control, not only its value.
    await machines.click();
    await expect(page).toHaveURL(/[?&]drawer=figure:dashboard\.total-machines/);
    const drawer = page.locator('aside.v2-drawer');
    await expect(drawer).not.toHaveAttribute('inert', '');
    await expect(drawer.getByText(/machines counted/)).toBeVisible();
    // The page that explains the figure, in the drawer's footer.
    await expect(drawer.getByRole('link', { name: /^Open / })).toHaveAttribute(
      'href',
      /screen=registers/,
    );

    // The pointer still rests on the card, so its hint is fading in; axe reads contrast at the settled colour.
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a instanceof CSSTransition)
          .map((a) => a.finished.catch(() => undefined)),
      ),
    );
    const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([]);

    await page.goBack();
    await expect(drawer).toHaveAttribute('inert', '');
    await expect(page).not.toHaveURL(/drawer=/);
  });
}
