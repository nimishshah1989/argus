import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A frame is one gallery section; axe scans only the frames a test names. */
export const frame = (id: string): string => `[data-testid="${id}"]`;

/** An open sheet, dialog or desktop side panel: the one frame that is not a section. */
export const DIALOG = '[role="dialog"]';

/**
 * The frames that exercise every kit component family: buttons and inputs, cards and lists, status
 * pills and the tone map, banners, sheets and dialogs, tables, charts. Every frame renders the same
 * kit, so axe scans these twelve; the screenshot comparison still covers all of them.
 */
export const KIT_FRAMES = [
  'gallery-components', // buttons, input, brand header, card, sheet
  'gallery-layout', // page, stack, inline, grid
  'gallery-status', // 40 status pills
  'gallery-meaning', // tone map and machine icons
  'gallery-shell', // banners, sync pills, both tab bars
  'gallery-queue', // lists, plus loading/empty/error/offline
  'gallery-detail', // detail layout and its states
  'gallery-forms', // form fields and sheet triggers
  'gallery-crud', // table and the add/edit sheet
  'gallery-dashboard', // KPI tiles and both charts
  'gallery-floor', // floor cards and bottom tab bar
  'gallery-closes', // sheet with radio, checkbox and textarea
].map(frame);

export async function expectAxeClean(
  page: Page,
  frames: readonly string[] = KIT_FRAMES,
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
  for (const selector of frames) builder = builder.include(selector);
  const axe = await builder.analyze();
  expect(axe.violations).toEqual([]);
}
