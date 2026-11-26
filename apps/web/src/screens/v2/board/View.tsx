import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SyncStatus } from '../../../patterns/sync-status.js';
import { CircleCheck, OctagonX, Tv } from '../../../ui/icon.js';
import { MachineIcon } from '../../../ui/machine-icon.js';
import { TONE_FILL, TONE_TEXT, statusMeaning } from '../../../ui/meaning.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import type { BoardColumn, BoardModel, StopRowModel } from './model.js';
import './board.css';

function Nav({ links }: { links: BoardModel['links'] }) {
  return (
    <nav className="flex flex-wrap items-center gap-2">
      {links.map((link) => {
        const item = (
          <Link to={link.to} className="v2-btn v2-btn-ghost">
            {link.wideOnly ? <Tv aria-hidden size={20} /> : null}
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
          <p className={`board-heroword inline-flex items-center gap-2 ${TONE_TEXT.ok}`}>
            <CircleCheck aria-hidden size={tv ? 56 : 18} strokeWidth={2.5} />
            {pulse.runningWord}
          </p>
          <p className="board-sub">{pulse.of}</p>
        </div>
      </div>
      <p className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 ${TONE_FILL.danger}`}>
        <OctagonX aria-hidden size={tv ? 58 : 20} strokeWidth={2.5} />
        <span data-testid="count-stopped" className="board-stopnum">
          {pulse.stopped}
        </span>
        <span className="board-stopword">{pulse.stoppedWord}</span>
      </p>
    </section>
  );
}

function StopRow({ row, tv, column }: { row: StopRowModel; tv: boolean; column: BoardColumn }) {
  const { t } = useTranslation();
  const side = tv ? '' : 'row-span-2';
  return (
    <li className="board-row flex items-center gap-3">
      <div
        data-testid="tile"
        className="grid min-h-16 min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-2"
      >
        <span className={side}>
          <MachineIcon segment={row.segment} status={column.status} size={tv ? 'lg' : 'md'} />
        </span>
        <p className="board-code truncate">
          {
            row.code // ui-allow: entity-code the wall board prints plain text; the TV has no link
          }
        </p>
        <p
          className={`board-age whitespace-nowrap ${side} ${row.ageTone ? TONE_TEXT[row.ageTone] : ''}`}
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
  const { tone, icon: Icon } = statusMeaning({ group: 'ticket', id: column.status });
  return (
    <section
      aria-label={column.title}
      className="board-card flex min-h-0 flex-col gap-2 overflow-hidden"
    >
      <div className="flex items-center justify-between">
        <span
          className={`board-chip inline-flex min-h-chip items-center gap-2 rounded-full px-3 ${TONE_FILL[tone]}`}
        >
          <Icon aria-hidden size={tv ? 32 : 16} />
          {column.chip}
        </span>
        <span className="board-count">{column.count}</span>
      </div>
      <h2 className="board-coltitle">{column.title}</h2>
      <ul>
        {column.rows.map((row) => (
          <StopRow key={row.id} row={row} tv={tv} column={column} />
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
    b.tone === 'muted' ? 'board-muted' : b.tone === 'danger' ? TONE_TEXT.danger : '';
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
 * The board drawn from its model: phone/desktop (nav, h1, "Updated", sync pill, pulse card, columns, ages card, day
 * tiles) or the TV (no link at all, sr-only h1, clock, 16:9 frame). `offline` adds the TV's "last numbers kept" line.
 */
export function BoardView({ model, offline }: { model: BoardModel; offline?: boolean }): ReactNode {
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
    <main className="v2-app mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4">
      <Nav links={model.links} />
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="board-title">{model.title}</h1>
          <p className="board-sub">{model.updated}</p>
        </div>
        <SyncStatus />
      </header>
      <section className="board-card">
        <Pulse model={model} />
      </section>
      {stops ? <Takeaway data={stops} /> : null}
      {columns}
      <Ages model={model} />
      <div className="grid grid-cols-2 gap-4">
        <DayTiles today={model.today} />
      </div>
    </main>
  );
}
