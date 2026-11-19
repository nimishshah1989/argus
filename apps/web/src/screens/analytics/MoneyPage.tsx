/* eslint-disable i18next/no-literal-string -- the template's kind and state are prop values, not copy */
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { canMoney, type Role } from '@uptimo/domain';
import { getMe, useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { viewState } from '../../patterns/view-state.js';
import { EmptyState } from '../../ui/elements/index.js';
import { DrillTable } from './DrillTable.js';
import { FigureDrill } from './KeyPage.js';
import { KeyBody, KeyKpi } from './key-body.js';
import { contentOf } from './figure-content.js';
import { parseDrill, type AnalyticsGroup } from './groups.js';
import { Template } from './shell/patterns/template.js';

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

/**
 * Money Matters (43e, rebuilt in the new look by ticket 87): the key page's ten money KPIs as tiles, the one chart,
 * the levers and lost tables and the ticket drill, on the overview template. The engine computes it for every
 * analytics role and the server withholds it from everyone but heads and admin; this screen shows the same
 * refusal in words rather than an empty or a guessed page. Every figure prints the engine's own text.
 */
export function MoneyPage({ group }: { group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const figures = useAnalyticsFigures();
  const online = useOnline();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const frame = { title: t('analytics.screen.money-matters') };
  if (me.isLoading) return <Template {...frame} kind="overview" state="loading" main={null} />;
  if (!mayReadMoney(me.data?.user.role))
    return (
      <Template
        {...frame}
        kind="overview"
        main={
          <EmptyState
            title={t('analytics.money.refusedTitle')}
            hint={t('analytics.money.refusedBody')}
          />
        }
      />
    );
  const state = viewState({
    online,
    hasData: figures.data !== undefined,
    isEmpty: false,
    error: figures.error,
  });
  if (state === 'error')
    return (
      <Template
        {...frame}
        kind="overview"
        state="error"
        onRetry={() => void figures.refetch()}
        main={null}
      />
    );
  if (state !== 'ready' || !figures.data)
    return (
      <Template
        {...frame}
        kind="overview"
        state={state === 'offline' ? 'offline' : 'loading'}
        main={null}
      />
    );
  const figure = figures.data.figures.find((candidate) => candidate.key === SCREEN_MONEY);
  const content = figure && figure.status === 'ready' ? contentOf(figure, t) : null;
  const drill = parseDrill(params.get('drill'));
  if (!figure || content?.kind !== 'page')
    return (
      <Template
        {...frame}
        kind="overview"
        main={<EmptyState title={t('analytics.notComputed')} />}
      />
    );
  return (
    <Template
      title={content.title === '' ? frame.title : content.title}
      kind="overview"
      lede={t('analytics.asOf', { date: figures.data.asOf })}
      figures={content.kpis.map((kpi, at) => (
        <KeyKpi key={`${kpi.label}-${at}`} kpi={kpi} />
      ))}
      main={
        <>
          {drill === null ? null : (
            <div data-span="full">
              <DrillTable group={group} drill={drill} />
            </div>
          )}
          <KeyBody tables={content.tables} charts={content.charts} />
          <div data-span="full">
            <FigureDrill figure={figure} group={group} />
          </div>
        </>
      }
    />
  );
}
