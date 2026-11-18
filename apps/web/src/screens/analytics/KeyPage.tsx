import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MAX_DRILL_IDS, type FiguresReply } from '@uptimo/shared/analytics';
import { Stack } from '../../ui/layout.js';
import { PageFigure } from './PageFigure.js';
import { contentOf } from './figure-content.js';
import { drillHref, groupOfScreen, type AnalyticsGroup } from './groups.js';
import type { PageTable } from './page-content.js';

type Figure = FiguresReply['figures'][number];

const whole = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

/**
 * A key-shaped screen (packets 40e-1 and 40e-2): A1, A2 and A3 each render the engine's page whole, with one
 * drill for the ticket list the engine named. The drill endpoint asks at most MAX_DRILL_IDS ids; when the page
 * names more than that, the link opens the Breakdown log, where every one of those tickets is a row that opens
 * its own page.
 */
export function KeyPage({
  figure,
  group,
  renderTable,
}: {
  figure: Figure | undefined;
  group: AnalyticsGroup;
  /** A screen's own card for one table (A4's Specialization); every other table keeps the shared renderer. */
  renderTable?: (table: PageTable, index: number) => ReactNode;
}) {
  const { t } = useTranslation();
  const content = figure ? contentOf(figure, t) : null;
  if (!figure || figure.status !== 'ready' || content?.kind !== 'page')
    return (
      <div data-page="not-computed" className="rounded-2xl bg-surface p-4 shadow-card">
        <p className="text-body font-medium text-neutral-600">{t('analytics.notComputed')}</p>
      </div>
    );
  return (
    <Stack gap={4}>
      <PageFigure content={content} renderTable={renderTable} />
      <FigureDrill figure={figure} group={group} />
    </Stack>
  );
}

/**
 * One figure's ticket drill: its inline link, or the Breakdown Log when it names more ids than one drill ask may
 * take. Shared by every key page and the report screens, so the too-many rule has one home.
 */
export function FigureDrill({ figure, group }: { figure: Figure; group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const ids = figure.drill.ids;
  if (ids.length === 0) return null;
  if (ids.length <= MAX_DRILL_IDS)
    return (
      <Link
        to={`${drillHref(group.id, figure.drill.type, ids)}&screen=${encodeURIComponent(figure.screen)}`}
        className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
      >
        {t('analytics.drill.open')}
      </Link>
    );
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface p-4 shadow-card">
      <p className="text-body text-neutral-600">
        {t('analytics.page.drillTooMany', { tickets: whole.format(ids.length) })}
      </p>
      <Link
        to={`/analytics/${groupOfScreen('breakdown-log')?.id ?? group.id}?screen=breakdown-log`}
        className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
      >
        {t('analytics.page.openLog')}
      </Link>
    </div>
  );
}
