import { describe, expect, it } from 'vitest';
import { oldUiLeft, reachable } from './old-ui-left.js';

const ROOT = new URL('..', import.meta.url).pathname;

// Every old-design component the shipped app still renders. This list may only shrink:
// a new entry fails (nothing new on the old kit), and a fixed entry must be crossed off here.
// "Nothing old remains" (ADR 0055) is done when this list is empty.
const OLD_LEFT = [
  'components/AccountSheet.tsx',
  'components/AlertsCard.tsx',
  'components/UpdateBanner.tsx',
  'faces/signin/parts.tsx',
  'patterns/crud-actions.tsx',
  'patterns/crud-list.tsx',
  'patterns/crud-page.tsx',
  'patterns/form-sheet.tsx',
  'patterns/frame.tsx',
  'patterns/queue-table.tsx',
  'patterns/sync-status.tsx',
  'screens/analytics/Analytics.tsx',
  'screens/settings/Company.tsx',
  'screens/settings/Jobs.tsx',
  'screens/settings/Plant.tsx',
  'screens/settings/Translations.tsx',
  'ui/banner.tsx',
  'ui/button.tsx',
  'ui/card.tsx',
  'ui/filter-chip.tsx',
  'ui/input.tsx',
  'ui/layout.tsx',
  'ui/segmented-bar.tsx',
  'ui/sheet.tsx',
  'ui/status/status-pill.tsx',
];

describe('nothing old remains (ADR 0051, ADR 0055)', () => {
  it('the shipped app reaches its screens', () => {
    const files = reachable(ROOT);
    expect(files).toContain('App.tsx');
    expect(files.some((f) => f.startsWith('screens/v2/'))).toBe(true);
    expect(files.some((f) => f.startsWith('gallery/'))).toBe(false);
  });

  it('renders no old-design component beyond the shrinking list', () => {
    expect(oldUiLeft(ROOT)).toEqual([...OLD_LEFT].sort());
  });
});
