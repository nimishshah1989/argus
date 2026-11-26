/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getConfig,
  getMe,
  getState,
  type CommandAction,
  type State,
  type Ticket,
} from '../../../api.js';
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
import { TicketPage } from '../ticket/Page.js';
import { openModel } from './adapter.js';
import { mayOpen, showsSettings, type OpenModel, type Segment } from './model.js';
import { OpenView } from './View.js';

const LINK = 'v2-btn v2-btn-ghost';

function SettingsLinks({ role }: { role?: string }) {
  const { t } = useTranslation();
  if (!showsSettings(role)) return null;
  return (
    <>
      <Link to="/settings/machines" className={LINK}>
        {t('plant.menu.link')}
      </Link>
      <Link to="/desk/settings" className={LINK}>
        {t('settings.title')}
      </Link>
    </>
  );
}

type BodyProps = {
  state: UseQueryResult<State>;
  model?: OpenModel;
  pending: boolean;
  onFilter: (filter: ChipFilter) => void;
  onSegment: (segment: Segment) => void;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
};

/** Wide (>= 1024 px): the chosen ticket (`TicketPage embedded`) beside the list; a phone has no pane. */
function OpenBody({ state, model, ...rest }: BodyProps) {
  const { t } = useTranslation();
  const { id } = useParams();
  const wide = useWide();
  if (model && state.data) {
    let pane: ReactNode;
    if (wide) pane = id ? <TicketPage embedded /> : null;
    return (
      <OpenView
        {...rest}
        model={model}
        signoff={<SignoffFeed now={state.data.now} />}
        pane={pane}
      />
    );
  }
  if (state.error) return <Banner tone="error" title={t('kit.pattern.error')} />;
  return (
    <Loading>
      <Skeleton shape="tile" />
      <Skeleton shape="row" />
      <Skeleton shape="tile" />
    </Loading>
  );
}

/**
 * `/desk` and `/desk/:id` (the live wiring): reads `/state`, `/config`, `/auth/me`, holds the filter and segment,
 * runs quick commands through `useCommand`, and refuses a role `mayOpen` refuses.
 */
export function DeskOpenPage(): ReactNode {
  const { t } = useTranslation();
  const state = useQuery({ queryKey: ['state'], queryFn: getState });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const { run, error, pending } = useCommand();
  const [filter, setFilter] = useState<ChipFilter>('');
  const [segment, setSegment] = useState<Segment>('breakdowns');
  const user = me.data?.user;
  if (user && !mayOpen('open', user.role))
    return (
      <NotAvailable
        roleLabel={t(`account.role.${user.role === 'plant_head' ? 'plantHead' : user.role}`)}
      />
    );

  const model = state.data
    ? openModel({ state: state.data, config: config.data, me: user, filter, segment }, t)
    : undefined;
  const onQuick = (ticket: Ticket, action: CommandAction) => {
    if (user?.actingPersonId) void run(ticket.id, action, {});
  };
  const updated = state.dataUpdatedAt
    ? t('deskLists.updated', { time: formatTime(new Date(state.dataUpdatedAt).toISOString()) })
    : undefined;
  return (
    <DeskFrame
      title={t('desk.tab.open')}
      subtitle={updated}
      current="open"
      badge={model?.badge ?? 0}
    >
      <div className="flex items-center justify-end gap-2">
        <SettingsLinks role={user?.role} />
      </div>
      <OfflineBanner />
      <Drafts />
      {error ? <Banner tone="error" title={error} /> : null}
      <OpenBody
        state={state}
        model={model}
        pending={pending}
        onFilter={setFilter}
        onSegment={setSegment}
        onQuick={onQuick}
      />
    </DeskFrame>
  );
}
