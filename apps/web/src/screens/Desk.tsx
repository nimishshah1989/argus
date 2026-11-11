import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getConfig, getMe, getState, type CommandAction, type Ticket } from '../api.js';
import { canWork, useTicketCommand } from '../components/actions.js';
import { AccountSheet } from '../components/AccountSheet.js';
import { Drafts } from '../components/Drafts.js';
import { NotificationsToggle } from '../components/NotificationsToggle.js';
import { OfflineBanner } from '../components/OfflineBanner.js';
import { Board, Tabs, type Tab } from './desk/Board.js';
import { MinePanel } from './desk/MinePanel.js';
import { TeamPanel } from './desk/TeamPanel.js';

const navLink = 'inline-flex min-h-13 items-center rounded-lg px-4 font-medium';

function DeskNav() {
  const { t } = useTranslation();
  return (
    <nav className="mb-6 flex gap-2">
      <Link to="/floor" className={`${navLink} text-neutral-600 hover:bg-neutral-200`}>
        {t('nav.report')}
      </Link>
      <Link to="/desk" className={`${navLink} bg-neutral-200 text-neutral-900`}>
        {t('nav.desk')}
      </Link>
    </nav>
  );
}

export function Desk() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('open');
  const state = useQuery({ queryKey: ['state'], queryFn: getState });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const personId = me.data?.user.actingPersonId;
  const { run, error, pending } = useTicketCommand();
  const machines = config.data?.machines ?? [];
  const canQuick = canWork(me.data?.user.role);

  function quick(ticket: Ticket, action: CommandAction) {
    if (!personId) return;
    void run(ticket.id, action, { personId });
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <DeskNav />

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('desk.title')}</h1>
        <AccountSheet />
      </div>
      <OfflineBanner />
      <NotificationsToggle />
      <Drafts />
      <Tabs tab={tab} onChange={setTab} />

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-stopped/10 p-3 text-stopped">
          {error}
        </p>
      )}

      {tab === 'mine' ? (
        <MinePanel machines={machines} />
      ) : tab === 'team' ? (
        <TeamPanel state={state} config={config.data} machines={machines} />
      ) : (
        <Board
          state={state}
          people={config.data?.people}
          machines={machines}
          canQuick={canQuick}
          pending={pending}
          onQuick={quick}
        />
      )}
    </main>
  );
}
