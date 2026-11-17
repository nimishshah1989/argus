import { useId } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Stack } from '../../ui/layout.js';
import { DrillTable } from './DrillTable.js';
import { FigureTile } from './FigureTile.js';
import { SCREEN_LABELS, parseDrill, type AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

function ScreenSection({
  group,
  screen,
  figures,
}: {
  group: AnalyticsGroup;
  screen: string;
  figures: Figure[];
}) {
  const { t } = useTranslation();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-title3 font-semibold">
        {t(SCREEN_LABELS[screen] ?? 'analytics.screen.unknown')}
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {figures.map((figure) => (
          <li key={figure.key}>
            <FigureTile figure={figure} group={group} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One group's screens and their figures, plus the drill rows when the query names them. */
export function GroupPage({ group }: { group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const figures = useAnalyticsFigures();
  const online = useOnline();
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
  const shown = group.screens
    .map((screen) => ({
      screen,
      figures: figures.data.figures.filter((figure) => figure.screen === screen),
    }))
    .filter(({ figures: list }) => list.length > 0);
  const drill = parseDrill(params.get('drill'));
  return (
    <Stack gap={6}>
      <p className="text-footnote text-neutral-600">
        {t('analytics.asOf', { date: figures.data.asOf })}
      </p>
      {drill ? <DrillTable group={group} drill={drill} /> : null}
      {shown.length === 0 ? (
        <p className="text-body text-neutral-600">{t('analytics.empty')}</p>
      ) : (
        shown.map(({ screen, figures: list }) => (
          <ScreenSection key={screen} group={group} screen={screen} figures={list} />
        ))
      )}
    </Stack>
  );
}
