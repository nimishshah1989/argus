import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MAX_DRILL_IDS, type FiguresReply } from '@uptimo/shared/analytics';
import { Stack } from '../../ui/layout.js';
import { PageFigure } from './PageFigure.js';
import { contentOf } from './figure-content.js';
import { drillHref, type AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

const whole = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

/**
 * A key-shaped screen (packets 40e-1 and 40e-2): A1, A2 and A3 each render the engine's page whole, with one
 * drill for the ticket list the engine named. The drill endpoint asks at most MAX_DRILL_IDS ids; when the page
 * names more than that, the link opens the Breakdown log, where every one of those tickets is a row that opens
 * its own page.
 */
export function KeyPage({ figure, group }: { figure: Figure | undefined; group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const content = figure ? contentOf(figure, t) : null;
  if (!figure || figure.status !== 'ready' || content?.kind !== 'page')
    return (
      <div data-page="not-computed" className="rounded-2xl bg-surface p-4 shadow-card">
        <p className="text-body font-medium text-neutral-600">{t('analytics.notComputed')}</p>
      </div>
    );
  const ids = figure.drill.ids;
  return (
    <Stack gap={4}>
      <PageFigure content={content} />
      {ids.length === 0 ? null : ids.length <= MAX_DRILL_IDS ? (
        <Link
          to={`${drillHref(group.id, 'ticket', ids)}&screen=${encodeURIComponent(figure.screen)}`}
          className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
        >
          {t('analytics.drill.open')}
        </Link>
      ) : (
        <div className="flex flex-col gap-1 rounded-2xl bg-surface p-4 shadow-card">
          <p className="text-body text-neutral-600">
            {t('analytics.page.drillTooMany', { tickets: whole.format(ids.length) })}
          </p>
          <Link
            to={`/analytics/${group.id}?screen=breakdown-log`}
            className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
          >
            {t('analytics.page.openLog')}
          </Link>
        </div>
      )}
    </Stack>
  );
}
