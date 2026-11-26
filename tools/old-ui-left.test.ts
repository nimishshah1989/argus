import { describe, expect, it } from 'vitest';
import { oldUiLeft, reachable } from './old-ui-left.js';

const ROOT = new URL('..', import.meta.url).pathname;

// Every old-design component the shipped app still renders. This list may only shrink:
// a new entry fails (nothing new on the old kit), and a fixed entry must be crossed off here.
// "Nothing old remains" (ADR 0055) is done when this list is empty.
const OLD_LEFT = [
  'components/AccountSheet.tsx',
  'components/ActionBar.tsx',
  'components/ActionForm.tsx',
  'components/AdminPanel.tsx',
  'components/AlertsCard.tsx',
  'components/CloseFlow.tsx',
  'components/Drafts.tsx',
  'components/FollowUpTask.tsx',
  'components/LockoutCard.tsx',
  'components/LockoutChip.tsx',
  'components/LockoutGate.tsx',
  'components/OfflineBanner.tsx',
  'components/PmClose.tsx',
  'components/PmReport.tsx',
  'components/ReportControls.tsx',
  'components/ReportSections.tsx',
  'components/SeverityBadge.tsx',
  'components/SignoffFeed.tsx',
  'components/SignoffPanel.tsx',
  'components/SlaTimerSummary.tsx',
  'components/StatusBadge.tsx',
  'components/TaskPanel.tsx',
  'components/TicketCard.tsx',
  'components/UpdateBanner.tsx',
  'components/closeSheets.tsx',
  'faces/signin/parts.tsx',
  'patterns/crud-actions.tsx',
  'patterns/crud-list.tsx',
  'patterns/crud-page.tsx',
  'patterns/form-sheet.tsx',
  'patterns/frame.tsx',
  'patterns/queue-table.tsx',
  'patterns/sync-status.tsx',
  'patterns/wizard-page.tsx',
  'screens/analytics/Analytics.tsx',
  'screens/desk/TicketRoute.tsx',
  'screens/settings/Company.tsx',
  'screens/settings/Jobs.tsx',
  'screens/settings/Plant.tsx',
  'screens/settings/Translations.tsx',
  'ui/banner.tsx',
  'ui/button.tsx',
  'ui/card.tsx',
  'ui/close-kit.tsx',
  'ui/counts-strip.tsx',
  'ui/detail-kit.tsx',
  'ui/elements/states.tsx',
  'ui/filter-chip.tsx',
  'ui/floor-pieces.tsx',
  'ui/input.tsx',
  'ui/layout.tsx',
  'ui/loading.tsx',
  'ui/machine-icon.tsx',
  'ui/segmented-bar.tsx',
  'ui/sheet.tsx',
  'ui/side-nav.tsx',
  'ui/status/status-pill.tsx',
  'ui/tab-bar.tsx',
  'ui/text.tsx',
  'ui/tick-row.tsx',
  'ui/ticket-card.tsx',
  'ui/top-bar.tsx',
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
