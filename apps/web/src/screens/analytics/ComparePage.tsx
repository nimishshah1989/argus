import { useSearchParams } from 'react-router-dom';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { Stack } from '../../ui/layout.js';
import { DrillTable } from './DrillTable.js';
import { KeyPage } from './KeyPage.js';
import { parseDrill, type AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

/**
 * Compare Machines (43e): the key page through the one KeyPage seam — no KPIs, the age-adjusted health
 * scorecard, the checkup, specifications, both longest-breakdown tables, by shift, and the two charts — with
 * the two-machine drill the engine chose. The page is the engine's; this module paints no cell of its own.
 */
export function ComparePage({
  figure,
  group,
}: {
  figure: Figure | undefined;
  group: AnalyticsGroup;
}) {
  const [params] = useSearchParams();
  const drill = parseDrill(params.get('drill'));
  return (
    <Stack gap={6}>
      {drill === null ? null : <DrillTable group={group} drill={drill} />}
      <KeyPage figure={figure} group={group} />
    </Stack>
  );
}
