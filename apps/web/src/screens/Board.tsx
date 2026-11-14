import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getConfig, getState, type Config, type Ticket } from '../api.js';
import { errorMessage, formatTime } from '../components/format.js';
import { BoardSections } from './board/BoardSections.js';
import { Counts } from './board/Counts.js';
import { SegmentFilter } from './board/SegmentFilter.js';
import { WorkFooter } from './board/WorkFooter.js';
import { boardCounts, buildSections, ticketsOnBoard } from './board/data.js';

const REFETCH_MS = 30_000;
const navLink = 'inline-flex min-h-13 items-center rounded-lg px-4 font-medium';

function BoardNav() {
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

function BoardHeader({
  kiosk,
  now,
  timeZone,
}: {
  kiosk: boolean;
  now?: string;
  timeZone?: string;
}) {
  const { t } = useTranslation();
  return (
    <header>
      <h1 className={kiosk ? 'text-4xl font-semibold tracking-tight' : 'text-2xl font-semibold'}>
        {t('board.title')}
      </h1>
      {now && (
        <p className={`mt-1 text-neutral-500 ${kiosk ? 'text-lg' : 'text-sm'}`}>
          {t('board.updated', { time: formatTime(now, timeZone) })}
        </p>
      )}
    </header>
  );
}

interface ContentProps {
  kiosk: boolean;
  open: Ticket[];
  config: Config | undefined;
  filter: string;
  onFilter: (id: string) => void;
  loading: boolean;
  error: unknown;
}

function BoardContent({ kiosk, open, config, filter, onFilter, loading, error }: ContentProps) {
  const { t } = useTranslation();
  if (loading) return <p className="mt-6 text-neutral-500">{t('common.loading')}</p>;
  if (error) {
    return (
      <p role="alert" className="mt-6 rounded-xl bg-stopped/10 p-3 text-stopped">
        {errorMessage(error)}
      </p>
    );
  }
  const sections = config
    ? buildSections(config.machines, config.segments, config.groups, open)
    : [];
  const visible = filter === 'all' ? sections : sections.filter((section) => section.id === filter);
  return (
    <>
      <Counts counts={boardCounts(config ? ticketsOnBoard(open, config) : open)} large={kiosk} />
      <SegmentFilter
        segments={(config?.segments ?? []).filter((segment) => segment.show_on_board)}
        value={filter}
        onChange={onFilter}
      />
      <BoardSections sections={visible} large={kiosk} />
      <WorkFooter open={open} machines={config?.machines ?? []} large={kiosk} />
    </>
  );
}

/** SPEC 1.7: a read-only live board of the plant, also opened as a kiosk on a wall TV. */
export function Board() {
  const [params] = useSearchParams();
  const kiosk = params.get('kiosk') === '1';
  const [filter, setFilter] = useState('all');
  const state = useQuery({
    queryKey: ['state'],
    queryFn: getState,
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
  });
  const config = useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
    staleTime: REFETCH_MS,
    refetchInterval: REFETCH_MS,
  });
  const loading = (state.isLoading && !state.data) || (config.isLoading && !config.data);

  return (
    <main
      className={kiosk ? 'min-h-screen px-4 py-4 sm:px-6' : 'mx-auto w-full max-w-7xl px-4 py-6'}
    >
      {!kiosk && <BoardNav />}
      <BoardHeader kiosk={kiosk} now={state.data?.now} timeZone={config.data?.timeZone} />
      <BoardContent
        kiosk={kiosk}
        open={state.data?.open ?? []}
        config={config.data}
        filter={filter}
        onFilter={setFilter}
        loading={loading}
        error={state.error ?? config.error}
      />
    </main>
  );
}
