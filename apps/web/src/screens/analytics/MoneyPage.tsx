/* eslint-disable i18next/no-literal-string -- the template's kind is a prop value, not copy */
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { canMoney, type Role } from '@uptimo/domain';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { getMe, useAnalyticsFigures } from '../../api.js';
import { EmptyState } from '../../ui/elements/index.js';
import { DrillTable } from './DrillTable.js';
import { FigureDrill } from './KeyPage.js';
import { KeyBody, KeyKpi } from './key-body.js';
import { contentOf } from './figure-content.js';
import { parseDrill, type AnalyticsGroup } from './groups.js';
import { NotReady, useFiguresState } from './screen-state.js';
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

/** The page whole: the ten KPIs as tiles, then the chart, the tables and the ticket drill. */
function MoneyReady({ reply, group }: { reply: FiguresReply; group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const figure = reply.figures.find((candidate) => candidate.key === SCREEN_MONEY);
  const content = figure && figure.status === 'ready' ? contentOf(figure, t) : null;
  const drill = parseDrill(params.get('drill'));
  const title = t('analytics.screen.money-matters');
  if (!figure || content?.kind !== 'page')
    return (
      <Template
        title={title}
        kind="overview"
        main={<EmptyState title={t('analytics.notComputed')} />}
      />
    );
  return (
    <Template
      title={content.title === '' ? title : content.title}
      kind="overview"
      lede={t('analytics.asOf', { date: reply.asOf })}
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

/**
 * Money Matters (43e, rebuilt in the new look by ticket 87): the key page's ten money KPIs as tiles, the one chart,
 * the levers and lost tables and the ticket drill, on the overview template. The engine computes it for every
 * analytics role and the server withholds it from everyone but heads and admin; this screen shows the same
 * refusal in words rather than an empty or a guessed page. Every figure prints the engine's own text.
 */
export function MoneyPage({ group }: { group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const figures = useAnalyticsFigures();
  const state = useFiguresState(figures);
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const title = t('analytics.screen.money-matters');
  if (me.isLoading) return <NotReady title={title} state="loading" onRetry={() => {}} />;
  if (!mayReadMoney(me.data?.user.role))
    return (
      <Template
        title={title}
        kind="overview"
        main={
          <EmptyState
            title={t('analytics.money.refusedTitle')}
            hint={t('analytics.money.refusedBody')}
          />
        }
      />
    );
  if (state !== 'ready' || !figures.data)
    return (
      <NotReady
        title={title}
        state={state === 'ready' ? 'loading' : state}
        onRetry={() => void figures.refetch()}
      />
    );
  return <MoneyReady reply={figures.data} group={group} />;
}
