import { useTranslation } from 'react-i18next';
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Stack } from '../../ui/layout.js';
import { FigureTile } from './FigureTile.js';
import { contentKind } from './figure-content.js';
import { groupFor } from './groups.js';

/**
 * The data checklist's own screen (packet 38.3): registered now so the menu is complete, honest until 38.2
 * computes it. It reads the same figures reply as the rest of the face and never invents a number.
 */
export function DataChecklist() {
  const { t } = useTranslation();
  const figures = useAnalyticsFigures();
  const online = useOnline();
  const group = groupFor('today');
  const state = viewState({
    online,
    hasData: figures.data !== undefined,
    isEmpty: false,
    error: figures.error,
  });
  if (state !== 'ready' || !figures.data || !group)
    return (
      <StateNotice
        state={state as Exclude<ViewState, 'ready'>}
        empty={t('analytics.empty')}
        onRetry={() => void figures.refetch()}
      />
    );
  const figure = figures.data.figures.find((candidate) => candidate.key === 'data-checklist');
  const kind = figure === undefined ? null : contentKind(figure);
  return (
    <Stack gap={6}>
      <h2 className="text-title2 font-semibold">{t('analytics.screen.data-checklist')}</h2>
      <p className="max-w-3xl text-body text-neutral-600">{t('analytics.checklist.intro')}</p>
      {figure ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li
            className={kind !== null && kind !== 'text' ? 'sm:col-span-2 lg:col-span-3' : undefined}
          >
            <FigureTile figure={figure} group={group} />
          </li>
        </ul>
      ) : (
        <p className="text-body text-neutral-600">{t('analytics.empty')}</p>
      )}
    </Stack>
  );
}
