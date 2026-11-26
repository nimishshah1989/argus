/* eslint-disable i18next/no-literal-string -- route and tone props, query keys; every visible word goes through t() */
import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getBrand, getConfig, getMe, getTicket, type Config, type Me } from '../../../api.js';
import { CloseFlow } from '../../../components/CloseFlow.js';
import { errorMessage } from '../../../components/format.js';
import { OfflineBanner } from '../../../components/OfflineBanner.js';
import { useCommand } from '../../../data/index.js';
import { SyncStatus } from '../../../patterns/sync-status.js';
import { TopBar } from '../../../ui/top-bar.js';
import { ErrorState, Skeleton } from '../../../ui/v2/screen-states.js';
import { ticketModel } from './adapter.js';
import { TicketView, type TicketViewProps } from './View.js';

type Body = Omit<TicketViewProps, 'model' | 'detail' | 'config' | 'me'> & {
  detail: UseQueryResult<TicketViewProps['detail']>;
  config?: Config;
  me?: Me;
  brand?: string;
};

/** The ticket, or what stands in for it: the error with its message and a Try again button, or the loading skeleton. */
function TicketBody({ detail, config, me, brand, ...rest }: Body): ReactNode {
  const { t } = useTranslation();
  if (detail.data) {
    const input = { detail: detail.data, config, me, now: new Date().toISOString(), brand };
    return (
      <TicketView
        {...rest}
        model={ticketModel(input, t)}
        detail={detail.data}
        config={config}
        me={me}
      />
    );
  }
  if (!detail.error) return <Skeleton />;
  return (
    <>
      <ErrorState onRetry={() => void detail.refetch()} />
      <p className="v2-sub">{errorMessage(detail.error)}</p>
    </>
  );
}

/**
 * `/desk/:id` (the live wiring, replaces v1 `TicketDetail`): reads `['ticket', id]`, `['config']`, `['me']` and the
 * brand, runs commands through `useCommand`, opens `CloseFlow` full screen, and shows loading, error (with Try again)
 * and not-found. `embedded`: inside the desk's pane, whose frame already shows the sync pill and offline banner.
 */
export function TicketPage({ embedded = false }: { embedded?: boolean }): ReactNode {
  const { id = '' } = useParams();
  const detail = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => getTicket(id),
    enabled: Boolean(id),
  });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const brand = useQuery({
    queryKey: ['brand'],
    queryFn: getBrand,
    staleTime: Infinity,
    retry: false,
  });
  const { run, error, pending } = useCommand();
  const [flow, setFlow] = useState<'close' | 'late' | null>(null);
  const personId = me.data?.user.actingPersonId;

  if (flow && detail.data && config.data && personId) {
    const ticketId = detail.data.ticket.id;
    return (
      <CloseFlow
        detail={detail.data}
        config={config.data}
        personId={personId}
        mode={flow}
        pending={pending}
        error={error}
        command={(action, body) => run(ticketId, action, body)}
        onExit={() => setFlow(null)}
      />
    );
  }

  return (
    <Frame embedded={embedded} loaded={Boolean(detail.data)}>
      <TicketBody
        detail={detail}
        config={config.data}
        me={me.data?.user}
        brand={brand.data?.company}
        run={run}
        pending={pending}
        error={error}
        onFlow={setFlow}
      />
    </Frame>
  );
}

/** The page's bar and offline banner; the desk's pane has neither (its frame shows them), and Back clears the pane. */
function Frame({
  embedded,
  loaded,
  children,
}: {
  embedded: boolean;
  loaded: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      {/* The loaded view carries its own "Open tickets" link; the bar has it only while there is nothing else to leave by. */}
      {embedded && loaded ? null : (
        <TopBar
          back={loaded ? undefined : { to: '/desk', label: t('detail.back') }}
          trailing={embedded ? undefined : <SyncStatus />}
        />
      )}
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
        {embedded ? null : <OfflineBanner />}
        {children}
      </main>
    </>
  );
}
