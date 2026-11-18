import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { canMoney, type Role } from '@uptimo/domain';
import { getMe, useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Stack } from '../../ui/layout.js';
import { DrillTable } from './DrillTable.js';
import { KeyPage } from './KeyPage.js';
import { parseDrill, type AnalyticsGroup } from './groups.js';

/** A neutral screen constant, so CI's secret scanner never reads a figure lookup as an API key. */
const SCREEN_MONEY = 'money-matters';

/** The server's own money rule (head, plant head and admin), so the face and the engine never disagree. */
export function mayReadMoney(role: string | undefined): boolean {
  if (role === undefined) return false;
  return canMoney({
    role: role as Role,
    loginId: '',
    personId: null,
    shared: false,
    cell: null,
  });
}

/** The honest refusal: the engine computes the page, but this login may not see it. */
function Refused() {
  const { t } = useTranslation();
  return (
    <section
      data-page="money-refused"
      className="flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-card"
    >
      <h2 className="text-title3 font-semibold">{t('analytics.money.refusedTitle')}</h2>
      <p className="text-body text-neutral-600">{t('analytics.money.refusedBody')}</p>
    </section>
  );
}

/**
 * Money Matters (43e): the key page's ten money KPIs, the levers and lost tables and the one chart, with its
 * ticket drill. The engine computes it for every analytics role and the server withholds it from everyone but
 * heads and admin; this screen shows the same refusal in words rather than an empty or a guessed page.
 */
export function MoneyPage({ group }: { group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const figures = useAnalyticsFigures();
  const online = useOnline();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  if (me.isLoading)
    return (
      <p role="status" className="text-body text-neutral-600">
        {t('common.loading')}
      </p>
    );
  if (!mayReadMoney(me.data?.user.role)) return <Refused />;
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
  const figure = figures.data.figures.find((candidate) => candidate.key === SCREEN_MONEY);
  const drill = parseDrill(params.get('drill'));
  return (
    <Stack gap={6}>
      {drill === null ? null : <DrillTable group={group} drill={drill} />}
      <KeyPage figure={figure} group={group} />
    </Stack>
  );
}
