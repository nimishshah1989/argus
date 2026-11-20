import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MAX_DRILL_IDS, type FiguresReply } from '@uptimo/shared/analytics';
import { Card } from '../../ui/card.js';
import { drillHref, groupOfScreen, type AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

const whole = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

/**
 * One figure's ticket drill: its inline link, or the Breakdown Log when it names more ids than one drill ask may
 * take (the drill endpoint asks at most MAX_DRILL_IDS ids; the log shows every one of those tickets as a row that
 * opens its own page). Shared by every key page and the report screens, so the too-many rule has one home.
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
    <Card>
      <p className="text-body text-neutral-600">
        {t('analytics.page.drillTooMany', { tickets: whole.format(ids.length) })}
      </p>
      <Link
        to={`/analytics/${groupOfScreen('breakdown-log')?.id ?? group.id}?screen=breakdown-log`}
        className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
      >
        {t('analytics.page.openLog')}
      </Link>
    </Card>
  );
}
