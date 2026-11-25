import type { Locator, Page } from '@playwright/test';

/**
 * Opens every "Show detail" fold on the Dashboard (ADR 0041: its later groups fold whole, and each group's tile tail
 * folds again inside). Waits for the body to draw (`ready`; on the Dashboard "What needs you now" is always in it, and
 * another page passes one of its own figures: the heading draws before the figures reply), then clicks the first
 * visible closed fold until none is left, so an outer fold opens before the inner ones it hides; no fold is fine.
 * A snapshot of `.all()` re-indexes as folds open and ends up clicking hidden ones (main after sweep A).
 */
export async function openShowDetail(
  page: Page,
  ready: Locator = page.getByRole('region', { name: 'What needs you now' }),
): Promise<void> {
  await ready.waitFor();
  const closed = page
    .locator('details.v2-show-detail:not([open]) > summary')
    .filter({ visible: true })
    .first();
  while ((await closed.count()) > 0) await closed.click();
}
