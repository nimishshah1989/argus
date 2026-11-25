import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getBoardToday, getConfig, getState } from '../../../api.js';
import { errorMessage } from '../../../components/format.js';
import { useSyncStatus } from '../../../data/index.js';
import { Banner } from '../../../ui/banner.js';
import { LoadingState } from '../../../ui/elements/states.js';
import { useSystemTheme } from '../../../ui/system-theme.js';
import { boardModel } from './adapter.js';
import { REFETCH_MS } from './model.js';
import { BoardView } from './View.js';

/**
 * `/desk/board` and `/desk/board?kiosk=1`: reads `/state`, `/config`, `/board/today` every REFETCH_MS, forces dark on
 * the TV (`useSystemTheme(tv)`), and shows loading, error (refetch continues) or the board.
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
  if (state.data && config.data)
    return (
      <BoardView
        model={boardModel({ state: state.data, config: config.data, today: today.data, tv }, t)}
        offline={offline}
      />
    );
  const error = state.error ?? config.error;
  return (
    <main className="v2-app mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4">
      {error ? (
        <Banner tone="error" title={errorMessage(error)} />
      ) : (
        <LoadingState label={t('common.loading')} tiles={2} />
      )}
    </main>
  );
}
