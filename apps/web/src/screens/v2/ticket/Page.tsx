import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getBrand, getConfig, getMe, getTicket } from '../../../api.js';
import { errorMessage } from '../../../components/format.js';
import { useCommand } from '../../../data/index.js';
import { ErrorState, Skeleton } from '../../../ui/v2/screen-states.js';
import { DeskWho, useDeskNav } from '../desk/Frame.js';
import { OfflineNotice, SyncStatus } from '../desk/parts.js';
import { EntityShell } from '../entity/EntityShell.js';
import { ticketModel } from './adapter.js';
import { CloseFlow } from './close/CloseFlow.js';
import type { TicketModel } from './model.js';
import { TicketView } from './View.js';

/** "← Open tickets" (back to the list it came from) and the sync pill, over the ticket. */
function BackRow({ to }: { to: string }) {
  const { t } = useTranslation();
  return (
    <p className="v2-desk-sync">
      <Link to={to} className="v2-btn v2-btn-ghost">
        {`← ${t('detail.back')}`}
      </Link>
      <SyncStatus />
    </p>
  );
}

const heading = (model: TicketModel | undefined): string | undefined =>
  model ? [model.title, model.ref].filter(Boolean).join(' · ') : undefined;

/** What the ticket page reads, and the model over it once the ticket is here. */
function useTicketData(id: string) {
  const { t } = useTranslation();
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
  const user = me.data?.user;
  const model = detail.data
    ? ticketModel(
        {
          detail: detail.data,
          config: config.data,
          me: user,
          now: new Date().toISOString(),
          brand: brand.data?.company,
        },
        t,
      )
    : undefined;
  return { detail, config: config.data, user, model };
}
type TicketData = ReturnType<typeof useTicketData>;

/** The ticket, the close flow in its place, or what stands in for it: loading, or the error with Try again. */
function TicketBody({ data }: { data: TicketData }): ReactNode {
  const { detail, config, user, model } = data;
  const { run, error, pending } = useCommand();
  const [flow, setFlow] = useState<'close' | 'late' | null>(null);
  const personId = user?.actingPersonId;
  if (flow && detail.data && config && personId) {
    const ticketId = detail.data.ticket.id;
    return (
      <CloseFlow
        detail={detail.data}
        config={config}
        personId={personId}
        mode={flow}
        pending={pending}
        error={error}
        command={(action, body) => run(ticketId, action, body)}
        onExit={() => setFlow(null)}
      />
    );
  }
  if (model && detail.data)
    return (
      <TicketView
        model={model}
        detail={detail.data}
        config={config}
        me={user}
        run={run}
        pending={pending}
        error={error}
        onFlow={setFlow}
      />
    );
  if (!detail.error) return <Skeleton />;
  return (
    <>
      <ErrorState onRetry={() => void detail.refetch()} />
      <p className="v2-sub">{errorMessage(detail.error)}</p>
    </>
  );
}

/**
 * `/desk/:id` (the live wiring, S29): reads `['ticket', id]`, `['config']`, `['me']` and the brand, runs commands
 * through `useCommand`, opens the close flow in place, and shows loading and error (with Try again). By link it is
 * a full page in the v2 Shell; `embedded` is the same page in the desk's side panel beside the list (`from`).
 */
export function TicketPage({
  embedded = false,
  from = '/desk',
}: {
  embedded?: boolean;
  from?: string;
}): ReactNode {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const data = useTicketData(id);
  const nav = useDeskNav(data.user?.role);
  if (embedded)
    return (
      <section aria-label={t('deskWide.ticket')} className="v2-desk">
        <BackRow to={from} />
        {data.model ? <h2 className="v2-h2">{heading(data.model)}</h2> : null}
        <TicketBody data={data} />
      </section>
    );
  return (
    <DeskWho>
      <EntityShell nav={nav} title={heading(data.model) ?? t('deskWide.ticket')}>
        <div className="v2-desk">
          <BackRow to={from} />
          <OfflineNotice />
          <TicketBody data={data} />
        </div>
      </EntityShell>
    </DeskWho>
  );
}
