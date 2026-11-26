/* eslint-disable i18next/no-literal-string -- routes only; every visible word goes through t() */
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getBoardToday,
  getConfig,
  getMe,
  getState,
  listTickets,
  type Me,
  type TicketListQuery,
} from '../../../api.js';
import { breakdownCount } from '../../desk/openLists.js';
import { mineQuery } from '../desk/team-model.js';
import { errorMessage } from '../../../components/format.js';
import { useSyncStatus } from '../../../data/index.js';
import { mayOpenDesk } from '../../../roles.js';
import { ErrorState, Skeleton } from '../../../ui/v2/screen-states.js';
import { Segmented } from '../../../ui/v2/segmented.js';
import { useSystemTheme } from '../../../ui/system-theme.js';
import type { DrawerSpec } from '../../../ui/v2/drawer.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useNav } from '../nav.js';
import { boardModel } from './adapter.js';
import { REFETCH_MS } from './model.js';
import { BoardView } from './View.js';

/**
 * The Desk's tabs, with the Live board pressed, and how many are open ("Open (n)": the Desk's breakdown count) and
 * mine ("Mine (n)": my jobs in progress or waiting, as the Mine screen lists them). A login that may not open the
 * Desk sees only the board, so none.
 */
function DeskTabs({ me, open }: { me: Me | undefined; open: number | undefined }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const desk = me !== undefined && mayOpenDesk(me.role);
  const query = { ...mineQuery(me), status: ['working', 'waiting'] } satisfies TicketListQuery;
  const mine = useQuery({
    queryKey: ['board-mine', query],
    queryFn: () => listTickets({ ...query, limit: 200 }),
    enabled: desk,
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
  }).data?.items.length;
  if (!desk) return null;
  const counted = (label: string, count: number | undefined) =>
    count === undefined ? label : t('live.tab.count', { label, count });
  return (
    <Segmented
      label={t('deskLists.tabs')}
      options={[
        { key: '/desk', label: counted(t('desk.tab.open'), open) },
        { key: '/desk/mine', label: counted(t('desk.tab.mine'), mine) },
        { key: '/desk/team', label: t('desk.tab.team') },
        { key: '/desk/board', label: t('deskLists.tab.live') },
      ]}
      value="/desk/board"
      onChange={(to) => navigate(to)}
    />
  );
}

/** Not loaded yet, or failed (the refetch keeps trying every REFETCH_MS): kit skeletons, or the error and its text. */
function States({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return error ? (
    <>
      <ErrorState onRetry={onRetry} />
      <p className="board-sub">{errorMessage(error)}</p>
    </>
  ) : (
    <Skeleton blocks={2} />
  );
}

/**
 * `/desk/board` and `/desk/board?kiosk=1`: reads `/state`, `/config`, `/board/today` every REFETCH_MS. The browser
 * board sits in the v2 Shell (rail on the Desk); the wall TV keeps its own full-screen frame and is forced dark
 * (`useSystemTheme(tv)`). Either shows loading, error (refetch continues) or the board. `drawer`: a stop's ticket
 * open beside the board (the Desk's `DeskRoute` passes it, ADR 0056 point 4).
 */
export function BoardPage({ drawer = null }: { drawer?: DrawerSpec | null }): ReactNode {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const tv = params.get('kiosk') === '1';
  useSystemTheme(tv);
  const offline = useSyncStatus() === 'offline';
  const live = { staleTime: REFETCH_MS, refetchInterval: REFETCH_MS };
  const state = useQuery({ queryKey: ['state'], queryFn: getState, ...live });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig, ...live });
  // A refused or failed day score leaves the tiles on a dash; the board stays up.
  const today = useQuery({ queryKey: ['board-today'], queryFn: getBoardToday, ...live });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe, enabled: !tv }).data?.user;
  const role = me?.role;
  const nav = useNav('today', role).map((item) => ({ ...item, current: item.id === 'desk' }));
  const model =
    state.data && config.data
      ? boardModel({ state: state.data, config: config.data, today: today.data, tv }, t)
      : null;
  const retry = () => {
    void state.refetch();
    void config.refetch();
  };
  const states = <States error={state.error ?? config.error} onRetry={retry} />;
  if (tv)
    return model ? (
      <BoardView model={model} offline={offline} />
    ) : (
      <main className="board-tv v2-app flex h-dvh flex-col gap-6 p-8">
        <h1 className="sr-only">{t('board.title')}</h1>
        {states}
      </main>
    );
  return (
    <EntityShell nav={nav} title={t('board.title')} drawer={drawer}>
      {model ? (
        <BoardView
          model={model}
          offline={offline}
          tabs={<DeskTabs me={me} open={state.data && breakdownCount(state.data.open)} />}
        />
      ) : (
        states
      )}
    </EntityShell>
  );
}
