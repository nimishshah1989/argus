import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getBoardToday,
  getConfig,
  getState,
  type BoardToday,
  type Config,
  type State,
} from '../api.js';
import { errorMessage, formatTime } from '../components/format.js';
import { SyncStatus } from '../patterns/sync-status.js';
import { Banner } from '../ui/banner.js';
import { LoadingState } from '../ui/elements/states.js';
import { Tv } from '../ui/icon.js';
import { COLUMNS, liveBoard } from './board/data.js';
import { Pulse } from './board/Pulse.js';
import { scaleFor } from './board/scale.js';
import { Scoreboard } from './board/Scoreboard.js';
import { StopColumn } from './board/StopColumn.js';
import { useSystemTheme } from './desk/Shell.js';

const REFETCH_MS = 30_000;
const KIOSK = '/desk/board?kiosk=1';
const navLink = 'inline-flex min-h-target items-center rounded-lg px-4 text-body font-medium';

function BoardNav() {
  const { t } = useTranslation();
  return (
    <nav className="flex flex-wrap gap-2">
      <Link
        to="/floor"
        className={`${navLink} text-neutral-600 [@media(hover:hover)]:hover:bg-neutral-200`}
      >
        {t('nav.report')}
      </Link>
      <Link to="/desk" className={`${navLink} bg-neutral-200 text-neutral-900`}>
        {t('nav.desk')}
      </Link>
      <Link
        to={KIOSK}
        className="ml-auto hidden min-h-target items-center gap-2 rounded-xl border border-control bg-surface px-4 text-body font-semibold text-neutral-900 sm:inline-flex"
      >
        <Tv aria-hidden size={20} />
        {t('live.openTv')}
      </Link>
    </nav>
  );
}

function dayLabel(iso: string, timeZone?: string): string {
  const day = { weekday: 'short', day: 'numeric', month: 'short', timeZone } as const;
  return new Intl.DateTimeFormat('en-GB', day).format(new Date(iso)).replace(',', '');
}

/** The phone and desktop say when the board last changed; the TV is a wall clock. */
function BoardHeader({ tv, now, timeZone }: { tv: boolean; now?: string; timeZone?: string }) {
  const { t } = useTranslation();
  if (tv) {
    return (
      <header className="text-right">
        <h1 className="sr-only">{t('board.title')}</h1>
        {now ? (
          <p className="text-tv-80 font-bold leading-none">{formatTime(now, timeZone)}</p>
        ) : null}
        {now ? (
          <p className="mt-2 text-title1 text-neutral-600">{dayLabel(now, timeZone)}</p>
        ) : null}
      </header>
    );
  }
  return (
    <header className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-title3 font-bold">{t('board.title')}</h1>
        {now ? (
          <p className="text-footnote text-neutral-600">
            {t('board.updated', { time: formatTime(now, timeZone) })}
          </p>
        ) : null}
      </div>
      <SyncStatus />
    </header>
  );
}

interface BodyProps {
  tv: boolean;
  state: State;
  config: Config;
  /** The TV's clock, beside the pulse. */
  clock: ReactNode;
  /** The day score; none while it loads or if it cannot be read (the tiles show a dash, the board stays up). */
  today: BoardToday | undefined;
}

function BoardBody({ tv, state, config, clock, today }: BodyProps) {
  const board = liveBoard(config, state.open, state.now);
  const scale = scaleFor(tv);
  const pulse = <Pulse board={board} scale={scale} />;
  return (
    <>
      {tv ? (
        <div className="flex items-start justify-between gap-12">
          {pulse}
          {clock}
        </div>
      ) : (
        <section className={`bg-surface shadow-card ${scale.card}`}>{pulse}</section>
      )}
      <div
        className={
          tv ? 'grid min-h-0 flex-1 grid-cols-3 gap-6' : 'grid gap-4 lg:grid-cols-3 lg:items-start'
        }
      >
        {COLUMNS.map((column) => (
          <StopColumn
            key={column}
            column={column}
            stops={board.columns[column]}
            config={config}
            scale={scale}
            tv={tv}
          />
        ))}
      </div>
      <Scoreboard ages={board.ages} today={today} scale={scale} tv={tv} />
    </>
  );
}

function Frame({ tv, children }: { tv: boolean; children: ReactNode }) {
  const tvFrame = 'flex h-dvh flex-col gap-6 overflow-hidden p-8';
  return (
    <main className={tv ? tvFrame : 'mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4'}>
      {children}
    </main>
  );
}

/** SPEC 1.7: the plant at a glance, on a phone, a desktop, and as a kiosk on a wall TV. */
export function Board() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const tv = params.get('kiosk') === '1';
  useSystemTheme(tv);
  const live = { staleTime: REFETCH_MS, refetchInterval: REFETCH_MS };
  const state = useQuery({ queryKey: ['state'], queryFn: getState, ...live });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig, ...live });
  const today = useQuery({ queryKey: ['board-today'], queryFn: getBoardToday, ...live });
  const error = state.error ?? config.error;
  const header = (
    <BoardHeader tv={tv} now={state.data?.now} timeZone={config.data?.timeZone ?? undefined} />
  );
  let body: ReactNode = <LoadingState label={t('common.loading')} tiles={2} />;
  if (state.data && config.data)
    body = (
      <BoardBody
        tv={tv}
        state={state.data}
        config={config.data}
        clock={tv ? header : null}
        today={today.data}
      />
    );
  else if (error) body = <Banner tone="error" title={errorMessage(error)} />;
  return (
    <Frame tv={tv}>
      {tv ? null : <BoardNav />}
      {tv ? null : header}
      {body}
    </Frame>
  );
}
