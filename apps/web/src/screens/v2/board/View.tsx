import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '../../../ui/v2/icons.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { SyncStatus } from '../../../ui/v2/sync-status.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import type { AgeTone, BoardColumn, BoardModel, StopRowModel } from './model.js';
import './board.css';

/** A column's status as the v2 kit says it: its tint and its icon, beside the chip's word. */
const STATUS: Record<BoardColumn['status'], { tone: 'loss' | 'plan' | 'risk'; icon: IconName }> = {
  stopped: { tone: 'loss', icon: 'stop' },
  in_progress: { tone: 'plan', icon: 'wrench' },
  waiting: { tone: 'risk', icon: 'pause' },
};

/** Red where nobody has started, amber while waiting, plain while repaired. */
const AGE_INK: Record<NonNullable<AgeTone>, string> = {
  danger: 'v2-seg-loss',
  hold: 'v2-seg-risk',
};

/** Plant segment codes to the v2 segment colours (ADR 0036 R23); a code the map does not know stays grey. */
const SEGMENT: Record<string, string> = {
  cnc: 'cnc',
  conventional: 'conv',
  process: 'process',
  utility: 'util',
  dg: 'dg',
  robot: 'robot',
};

/** A machine's tile: the colour is its segment, never good or bad. Decorative: the row names the machine. */
function MachineTile({ segment, tv }: { segment: string; tv: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-machine={segment}
      data-seg={SEGMENT[segment.toLowerCase()]}
      className={`board-machine ${tv ? 'h-14 w-14 rounded-2xl' : 'h-10 w-10 rounded-xl'}`}
    >
      {/* eslint-disable-next-line i18next/no-literal-string -- an icon name, not copy */}
      <Icon name="machines" size={tv ? 32 : 22} />
    </span>
  );
}

function Nav({ links, tabs }: { links: BoardModel['links']; tabs?: ReactNode }) {
  return (
    <nav className="flex flex-wrap items-center gap-2">
      {tabs}
      {links.map((link) => {
        const item = (
          <Link to={link.to} className="v2-btn v2-btn-ghost">
            {link.label}
          </Link>
        );
        return link.wideOnly ? (
          <span key={link.to} className="ml-auto hidden sm:block">
            {item}
          </span>
        ) : (
          <span key={link.to}>{item}</span>
        );
      })}
    </nav>
  );
}

function Pulse({ model }: { model: BoardModel }) {
  const { pulse, tv } = model;
  return (
    <section aria-label={pulse.aria} className="flex flex-wrap items-end gap-x-12 gap-y-3">
      <div className="flex items-end gap-3">
        <span data-testid="count-running" className="board-hero">
          {pulse.running}
        </span>
        <div>
          <p className="board-heroword v2-seg-gain inline-flex items-center gap-2">
            {/* eslint-disable-next-line i18next/no-literal-string -- an icon name, not copy */}
            <Icon name="check" size={tv ? 56 : 18} />
            {pulse.runningWord}
          </p>
          <p className="board-sub">{pulse.of}</p>
        </div>
      </div>
      <p className="board-fill-loss inline-flex items-center gap-2 rounded-xl px-3 py-2">
        {/* eslint-disable-next-line i18next/no-literal-string -- an icon name, not copy */}
        <Icon name="stop" size={tv ? 58 : 20} />
        <span data-testid="count-stopped" className="board-stopnum">
          {pulse.stopped}
        </span>
        <span className="board-stopword">{pulse.stoppedWord}</span>
      </p>
    </section>
  );
}

function StopRow({ row, tv }: { row: StopRowModel; tv: boolean }) {
  const { t } = useTranslation();
  const side = tv ? '' : 'row-span-2';
  return (
    <li className="board-row flex items-center gap-3">
      <div
        data-testid="tile"
        className="grid min-h-16 min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-2"
      >
        <span className={side}>
          <MachineTile segment={row.segment} tv={tv} />
        </span>
        <p className="board-code truncate">
          {
            row.code // ui-allow: entity-code the wall board prints plain text; the TV has no link
          }
        </p>
        <p
          className={`board-age whitespace-nowrap ${side} ${row.ageTone ? AGE_INK[row.ageTone] : ''}`}
        >
          {row.age}
        </p>
        <p className={`board-sub col-start-2 ${tv ? 'col-span-2 mt-1' : 'truncate'}`}>{row.sub}</p>
      </div>
      {/* eslint-disable-next-line i18next/no-literal-string -- a tone and an icon name, not copy */}
      {row.longest ? <KeyPill text={t('live.longest')} tone="loss" icon="alert" /> : null}
    </li>
  );
}

function Column({ column, tv }: { column: BoardColumn; tv: boolean }) {
  const { tone, icon } = STATUS[column.status];
  return (
    <section
      aria-label={column.title}
      className="board-card flex min-h-0 flex-col gap-2 overflow-hidden"
    >
      <div className="flex items-center justify-between">
        <span
          className={`board-chip inline-flex min-h-chip items-center gap-2 rounded-full px-3 board-fill-${tone}`}
        >
          <Icon name={icon} size={tv ? 32 : 16} />
          {column.chip}
        </span>
        <span className="board-count">{column.count}</span>
      </div>
      <h2 className="board-coltitle">{column.title}</h2>
      <ul>
        {column.rows.map((row) => (
          <StopRow key={row.id} row={row} tv={tv} />
        ))}
      </ul>
      {column.more ? <p className="board-sub">{column.more}</p> : null}
    </section>
  );
}

function Columns({ model }: { model: BoardModel }) {
  const { tv } = model;
  return (
    <div
      className={
        tv ? 'grid min-h-0 flex-1 grid-cols-3 gap-6' : 'grid gap-4 lg:grid-cols-3 lg:items-start'
      }
    >
      {model.columns.map((column) => (
        <Column key={column.column} column={column} tv={tv} />
      ))}
    </div>
  );
}

function Ages({ model }: { model: BoardModel }) {
  const { ages, tv, takeaways } = model;
  const overDay = ages.buckets.find((b) => b.key === 'overDay');
  const tone = (b: { tone: 'muted' | 'danger' | null }) =>
    b.tone === 'muted' ? 'board-muted' : b.tone === 'danger' ? AGE_INK.danger : '';
  if (tv && overDay)
    return (
      <section aria-label={ages.title} className="board-card flex items-center gap-6">
        <p data-testid="age-overDay" className={`board-big ${tone(overDay)}`}>
          {overDay.count}
        </p>
        <div>
          <p className="board-sub">{ages.overDayTitle}</p>
          <p className="board-sub">{ages.line}</p>
        </div>
      </section>
    );
  return (
    <section aria-label={ages.title} className="board-card flex flex-col gap-2">
      <h2 className="board-stopword">{ages.title}</h2>
      {takeaways['board.ages'] ? <Takeaway data={takeaways['board.ages']} /> : null}
      <dl className="m-0 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {ages.buckets.map((bucket) => (
          <div key={bucket.key} className="flex flex-col-reverse">
            <dt className="board-sub">{bucket.label}</dt>
            <dd data-testid={`age-${bucket.key}`} className={`board-big m-0 ${tone(bucket)}`}>
              {bucket.count}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DayTiles({ today }: { today: BoardModel['today'] }) {
  return (
    <>
      {today.map((tile) => (
        <div key={tile.id} role="group" aria-label={tile.label} className="board-card">
          <p className="board-sub">{tile.label}</p>
          <p className="board-big m-0">{tile.value}</p>
          <p className="board-sub">{tile.note ?? ' '}</p>
        </div>
      ))}
    </>
  );
}

/**
 * The board drawn from its model: in the browser the inside of the Shell, whose header carries the title (the Desk
 * tabs and links, "Updated" and the sync pill, pulse card, columns, ages card, day tiles), or the TV's own frame (no
 * link at all, sr-only h1, clock, 16:9). `offline` adds the TV's "last numbers kept" line.
 */
export function BoardView({
  model,
  offline,
  tabs,
}: {
  model: BoardModel;
  offline?: boolean;
  /** The Desk's tabs, first in the row of links (browser only). */
  tabs?: ReactNode;
}): ReactNode {
  const { t } = useTranslation();
  const { tv, takeaways } = model;
  const stops = takeaways['board.stops'];
  const columns = <Columns model={model} />;
  if (tv)
    return (
      <main className="board-tv v2-app flex h-dvh flex-col gap-6 overflow-hidden p-8">
        <div className="flex items-start justify-between gap-12">
          <Pulse model={model} />
          <header className="text-right">
            <h1 className="sr-only">{model.title}</h1>
            <p className="board-clock">{model.clock?.time}</p>
            <p className="board-day">
              {model.clock?.day} · {model.updated}
            </p>
          </header>
        </div>
        {stops ? <Takeaway data={stops} /> : null}
        {columns}
        <div className="grid grid-cols-3 gap-6">
          <Ages model={model} />
          <DayTiles today={model.today} />
        </div>
        {offline ? (
          <p role="status" className="board-sub">
            {t('live.offlineKept')}
          </p>
        ) : null}
      </main>
    );
  return (
    <>
      <Nav links={model.links} tabs={tabs} />
      <div className="flex flex-wrap items-center gap-3">
        <p className="board-sub">{model.updated}</p>
        <SyncStatus />
      </div>
      <section className="board-card">
        <Pulse model={model} />
      </section>
      {stops ? <Takeaway data={stops} /> : null}
      {columns}
      <Ages model={model} />
      <div className="grid grid-cols-2 gap-4">
        <DayTiles today={model.today} />
      </div>
    </>
  );
}
