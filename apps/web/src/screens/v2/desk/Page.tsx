/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getConfig, getMe, getState, type CommandAction, type Ticket } from '../../../api.js';
import { Drafts } from '../../../components/Drafts.js';
import { formatTime } from '../../../components/format.js';
import { OfflineBanner } from '../../../components/OfflineBanner.js';
import { SignoffFeed } from '../../../components/SignoffFeed.js';
import { useCommand } from '../../../data/index.js';
import { useWide } from '../../../patterns/wide.js';
import { Banner } from '../../../ui/banner.js';
import { Loading, Skeleton } from '../../../ui/loading.js';
import type { ChipFilter } from '../../desk/openLists.js';
import { DeskFrame, NotAvailable } from '../../desk/Shell.js';
import { TicketDetail } from '../../TicketDetail.js';
import { openModel } from './adapter.js';
import { mayOpen, showsSettings, type Segment } from './model.js';
import { OpenView } from './View.js';

const LINK =
  'inline-flex min-h-target-min items-center rounded-xl border border-control bg-surface px-4 text-body font-semibold';

/**
 * `/desk` and `/desk/:id` (the live wiring): reads `/state`, `/config`, `/auth/me`, holds the filter and segment,
 * runs quick commands through `useCommand`, refuses a role `mayOpen` refuses, and from 1024 px draws the chosen
 * ticket (v1 `TicketDetail embedded`, until S29) beside the list.
 */
export function DeskOpenPage(): ReactNode {
  const { t } = useTranslation();
  const state = useQuery({ queryKey: ['state'], queryFn: getState });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const { run, error, pending } = useCommand();
  const { id } = useParams();
  const wide = useWide();
  const [filter, setFilter] = useState<ChipFilter>('');
  const [segment, setSegment] = useState<Segment>('breakdowns');
  const user = me.data?.user;
  if (user && !mayOpen('open', user.role))
    return <NotAvailable roleLabel={t(`account.role.${user.role === 'plant_head' ? 'plantHead' : user.role}`)} />;

  const model = state.data
    ? openModel({ state: state.data, config: config.data, me: user, filter, segment }, t)
    : undefined;
  const onQuick = (ticket: Ticket, action: CommandAction) => {
    if (user?.actingPersonId) void run(ticket.id, action, {});
  };
  let body: ReactNode;
  if (model && state.data)
    body = (
      <OpenView
        model={model}
        pending={pending}
        onFilter={setFilter}
        onSegment={setSegment}
        onQuick={onQuick}
        signoff={<SignoffFeed now={state.data.now} />}
        pane={wide ? id ? <TicketDetail embedded /> : null : undefined}
      />
    );
  else if (state.error) body = <Banner tone="error" title={t('kit.pattern.error')} />;
  else
    body = (
      <Loading>
        <Skeleton shape="tile" />
        <Skeleton shape="row" />
        <Skeleton shape="tile" />
      </Loading>
    );
  return (
    <DeskFrame
      title={t('desk.tab.open')}
      subtitle={
        state.dataUpdatedAt
          ? t('deskLists.updated', { time: formatTime(new Date(state.dataUpdatedAt).toISOString()) })
          : undefined
      }
      current="open"
      badge={model?.badge ?? 0}
    >
      <div className="flex items-center justify-end gap-2">
        {showsSettings(user?.role) ? (
          <>
            <Link to="/settings/machines" className={LINK}>
              {t('plant.menu.link')}
            </Link>
            <Link to="/desk/settings" className={LINK}>
              {t('settings.title')}
            </Link>
          </>
        ) : null}
      </div>
      <OfflineBanner />
      <Drafts />
      {error ? <Banner tone="error" title={error} /> : null}
      {body}
    </DeskFrame>
  );
}
