/* eslint-disable i18next/no-literal-string -- routes only; every visible word goes through t() */
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getBoardToday, getConfig, getMe, getState } from '../../../api.js';
import { errorMessage } from '../../../components/format.js';
import { useSyncStatus } from '../../../data/index.js';
import { mayOpenDesk } from '../../../roles.js';
import { ErrorState, Skeleton } from '../../../ui/v2/screen-states.js';
import { Segmented } from '../../../ui/v2/segmented.js';
import { useSystemTheme } from '../../../ui/system-theme.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useNav } from '../nav.js';
import { boardModel } from './adapter.js';
import { REFETCH_MS } from './model.js';
import { BoardView } from './View.js';

/** The Desk's tabs, with the Live board pressed; a login that may not open the Desk sees only the board, so none. */
function DeskTabs({ role }: { role: string | undefined }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (role === undefined || !mayOpenDesk(role)) return null;
  return (
    <Segmented
      label={t('deskLists.tabs')}
      options={[
        { key: '/desk', label: t('desk.tab.open') },
        { key: '/desk/mine', label: t('desk.tab.mine') },
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
 * (`useSystemTheme(tv)`). Either shows loading, error (refetch continues) or the board.
 */
export function BoardPage(): ReactNode {
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
  const role = useQuery({ queryKey: ['me'], queryFn: getMe, enabled: !tv }).data?.user.role;
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
    <EntityShell nav={nav} title={t('board.title')}>
      {model ? (
        <BoardView model={model} offline={offline} tabs={<DeskTabs role={role} />} />
      ) : (
        states
      )}
    </EntityShell>
  );
}
