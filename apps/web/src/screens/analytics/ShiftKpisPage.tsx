import type { FiguresReply } from '@uptimo/shared/analytics';
import { Stack } from '../../ui/layout.js';
import { KeyPage } from './KeyPage.js';
import type { AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

/**
 * The shift-calendar KPIs screen (ticket 48, R12): the screen's figures in registry order, each drawn by the house
 * key page and each carrying its own ticket drill. Packet 48a lands the comparison; 48b and 48c add the shift split,
 * the backlog and the breakdown map to the same screen, so a head reads them all in one place.
 */
export function ShiftKpisPage({
  figures,
  group,
}: {
  figures: readonly Figure[];
  group: AnalyticsGroup;
}) {
  return (
    <Stack gap={6}>
      {figures.map((figure) => (
        <KeyPage key={figure.key} figure={figure} group={group} />
      ))}
    </Stack>
  );
}
