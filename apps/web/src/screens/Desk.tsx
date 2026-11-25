/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
import { Link } from 'react-router-dom';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getConfig,
  getMe,
  getState,
  type CommandAction,
  type Config,
  type Me,
  type State,
  type Ticket,
} from '../api.js';
import { actorFrom } from '../components/actionSpecs.js';
import { formatTime, peopleNames } from '../components/format.js';
import { useCommand } from '../data/index.js';
import { Drafts } from '../components/Drafts.js';
import { OfflineBanner } from '../components/OfflineBanner.js';
import { Banner } from '../ui/banner.js';
import { Loading, Skeleton } from '../ui/loading.js';
import { MinePanel, type CardContext } from './desk/MinePanel.js';
import { breakdownCount } from './desk/openLists.js';
import { DeskFrame, NotAvailable, mayOpen, type DeskView } from './desk/Shell.js';
import { TeamPanel } from './desk/TeamPanel.js';

/** Settings is an admin/head surface; other roles never see the link. */
function SettingsLink({ role }: { role?: string }) {
  const { t } = useTranslation();
  if (role !== 'admin' && role !== 'head') return null;
  const link =
    'inline-flex min-h-target-min items-center rounded-xl border border-control bg-surface px-4 text-body font-semibold';
  return (
    <>
      <Link to="/settings/machines" className={link}>
        {t('plant.menu.link')}
      </Link>
      <Link to="/desk/settings" className={link}>
        {t('settings.title')}
      </Link>
    </>
  );
}

function DeskBody({
  view,
  state,
  config,
  ctx,
}: {
  view: DeskView;
  state: UseQueryResult<State>;
  config?: Config;
  ctx: CardContext;
}) {
  if (view === 'mine') return <MinePanel ctx={ctx} />;
  return <TeamPanel state={state} config={config} machines={ctx.machines} />;
}

function cardContext(
  state: State | undefined,
  config: Config | undefined,
  user: Me | undefined,
  command: { pending: boolean; run: ReturnType<typeof useCommand>['run'] },
): CardContext {
  return {
    now: state?.now ?? new Date().toISOString(),
    machines: config?.machines ?? [],
    names: peopleNames(config?.people),
    actor: user ? actorFrom(user) : null,
    pending: command.pending,
    onQuick: (ticket: Ticket, action: CommandAction) => {
      if (user?.actingPersonId) void command.run(ticket.id, action, {});
    },
  };
}

function roleLabel(role: string, t: (key: string) => string): string {
  return t(`account.role.${role === 'plant_head' ? 'plantHead' : role}`);
}

const TITLE = { open: 'desk.tab.open', mine: 'desk.mineTitle', team: 'desk.teamNow' } as const;

/** One desk screen (Open, Mine or Team) inside the header and tab bar, for the roles that may open it. */
export function Desk({ view }: { view: DeskView }) {
  const { t } = useTranslation();
  const state = useQuery({ queryKey: ['state'], queryFn: getState });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const { run, error, pending } = useCommand();
  const { id } = useParams();
  const wide = useWide();
  const user = me.data?.user;
  if (user && !mayOpen(view, user.role))
    return <NotAvailable roleLabel={roleLabel(user.role, t)} />;

  const ctx = cardContext(state.data, config.data, user, { pending, run });
  const updated = state.dataUpdatedAt
    ? t('deskLists.updated', { time: formatTime(new Date(state.dataUpdatedAt).toISOString()) })
    : undefined;
  const body = <DeskBody view={view} state={state} config={config.data} ctx={ctx} />;
  return (
    <DeskFrame
      title={t(TITLE[view])}
      subtitle={updated}
      current={view}
      badge={breakdownCount(state.data?.open ?? [])}
    >
      <div className="flex items-center justify-end gap-2">
        <SettingsLink role={user?.role} />
      </div>
      <OfflineBanner />
      <Drafts />
      {error ? <Banner tone="error" title={error} /> : null}
      {view === 'open' && wide ? <TwoPane list={body} ticketId={id} /> : body}
    </DeskFrame>
  );
}
