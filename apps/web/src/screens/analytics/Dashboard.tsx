import { useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Stack } from '../../ui/layout.js';
import { DrillTable } from './DrillTable.js';
import { FigureTile } from './FigureTile.js';
import { NeedsNow } from './NeedsNow.js';
import { CHECKLIST_PATH, parseDrill, type AnalyticsGroup } from './groups.js';

/**
 * The Today Dashboard (packet 38.3): the head's home. The eleven computable figures print their values and
 * drill to their rows; the held ones stay honestly "Not computed yet". What needs a person now sits above
 * them, built from the desk's existing `/state`. No money appears on Today.
 */
export function Dashboard({ group }: { group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const figures = useAnalyticsFigures();
  const online = useOnline();
  const headingId = useId();
  const state = viewState({
    online,
    hasData: figures.data !== undefined,
    isEmpty: false,
    error: figures.error,
  });
  if (state !== 'ready' || !figures.data)
    return (
      <StateNotice
        state={state as Exclude<ViewState, 'ready'>}
        empty={t('analytics.empty')}
        onRetry={() => void figures.refetch()}
      />
    );
  const list = figures.data.figures.filter((figure) => figure.screen === 'dashboard');
  const drill = parseDrill(params.get('drill'));
  return (
    <Stack gap={6}>
      <p className="text-footnote text-neutral-600">
        {t('analytics.asOf', { date: figures.data.asOf })}
      </p>
      <NeedsNow />
      {drill ? <DrillTable group={group} drill={drill} /> : null}
      <section aria-labelledby={headingId} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={headingId} className="text-title3 font-semibold">
            {t('analytics.screen.dashboard')}
          </h2>
          <Link
            to={CHECKLIST_PATH}
            className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
          >
            {t('analytics.screen.data-checklist')}
          </Link>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((figure) => (
            <li key={figure.key}>
              <FigureTile figure={figure} group={group} />
            </li>
          ))}
        </ul>
      </section>
    </Stack>
  );
}
