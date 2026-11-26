import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/v2/icons.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { BrowserBoard } from './Browser.js';
import type { BoardColumn, BoardModel, StopRowModel } from './model.js';
import { AGE_INK, MachineTile, STATUS } from './parts.js';
import './board.css';

// Everything down to `BoardView` is the wall TV only; its sizes scale with the screen (`.board-tv` in board.css).
function Pulse({ model }: { model: BoardModel }) {
  const { pulse } = model;
  return (
    <section aria-label={pulse.aria} className="flex items-end gap-12 whitespace-nowrap">
      <div className="flex items-end gap-3">
        <span data-testid="count-running" className="board-hero">
          {pulse.running}
        </span>
        <div>
          <p className="board-heroword v2-seg-gain inline-flex items-center gap-2">
            {/* eslint-disable-next-line i18next/no-literal-string -- an icon name, not copy */}
            <Icon name="check" />
            {pulse.runningWord}
          </p>
          <p className="board-sub">{pulse.of}</p>
        </div>
      </div>
      <p className="board-stopped board-fill-loss inline-flex items-center gap-2 rounded-xl px-3 py-2">
        {/* eslint-disable-next-line i18next/no-literal-string -- an icon name, not copy */}
        <Icon name="stop" />
        <span data-testid="count-stopped" className="board-stopnum">
          {pulse.stopped}
        </span>
        <span className="board-stopword">{pulse.stoppedWord}</span>
      </p>
    </section>
  );
}

function StopRow({ row }: { row: StopRowModel }) {
  const { t } = useTranslation();
  return (
    <li className="board-row">
      <div
        data-testid="tile"
        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-2"
      >
        <span className="row-span-2">
          <MachineTile segment={row.segment} tv />
        </span>
        <p className="board-code truncate">
          {
            row.code // ui-allow: entity-code the wall board prints plain text; the TV has no link
          }
        </p>
        <p className={`board-age whitespace-nowrap ${row.ageTone ? AGE_INK[row.ageTone] : ''}`}>
          {row.age}
        </p>
        <div className="col-span-2 col-start-2 mt-1 flex items-center justify-between gap-3">
          <p className="board-sub truncate">{row.sub}</p>
          {/* eslint-disable-next-line i18next/no-literal-string -- a tone and an icon name, not copy */}
          {row.longest ? <KeyPill text={t('live.longest')} tone="loss" icon="alert" /> : null}
        </div>
      </div>
    </li>
  );
}

function Column({ column }: { column: BoardColumn }) {
  const { tone, icon } = STATUS[column.status];
  return (
    <section
      aria-label={column.title}
      className="board-card flex min-h-0 flex-col gap-2 overflow-hidden"
    >
      <div className="flex items-center justify-between">
        <span
          className={`board-chip inline-flex items-center gap-2 rounded-full px-3 board-fill-${tone}`}
        >
          <Icon name={icon} />
          {column.chip}
        </span>
        <span className="board-count">{column.count}</span>
      </div>
      <h2 className="board-coltitle">{column.title}</h2>
      <ul>
        {column.rows.map((row) => (
          <StopRow key={row.id} row={row} />
        ))}
      </ul>
      {column.more ? <p className="board-sub">{column.more}</p> : null}
    </section>
  );
}

/** The bottom row: open over 1 day with the other buckets in a line, then the two day tiles. */
function Foot({ model }: { model: BoardModel }) {
  const { ages, today } = model;
  const overDay = ages.buckets.find((b) => b.key === 'overDay');
  const tone =
    overDay?.tone === 'muted' ? 'board-muted' : overDay?.tone === 'danger' ? AGE_INK.danger : '';
  return (
    <div className="grid grid-cols-3 gap-4">
      <section aria-label={ages.title} className="board-card board-foot flex items-center gap-6">
        <p data-testid="age-overDay" className={`board-big ${tone}`}>
          {overDay?.count}
        </p>
        <div>
          <p className="board-sub">{ages.overDayTitle}</p>
          <p className="board-sub">{ages.line}</p>
        </div>
      </section>
      {today.map((tile) => (
        <div key={tile.id} role="group" aria-label={tile.label} className="board-card board-foot">
          <p className="board-sub">{tile.label}</p>
          <p className="board-big m-0">{tile.value}</p>
          <p className="board-sub">{tile.note ?? ' '}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * The board drawn from its model: in the browser the inside of the Shell (`BrowserBoard`), or the TV's own frame (no
 * link at all, sr-only h1, clock, 16:9), which the components here draw. `offline` adds the TV's "last numbers kept"
 * line.
 */
export function BoardView({
  model,
  offline,
  tabs,
}: {
  model: BoardModel;
  offline?: boolean;
  /** The Desk's tabs, beside the links (browser only). */
  tabs?: ReactNode;
}): ReactNode {
  const { t } = useTranslation();
  const { tv, takeaways } = model;
  const stops = takeaways['board.stops'];
  if (tv)
    return (
      <main className="board-tv v2-app flex h-dvh flex-col gap-4 overflow-hidden p-6">
        <div className="flex items-start justify-between gap-12">
          <Pulse model={model} />
          <header className="whitespace-nowrap text-right">
            <h1 className="sr-only">{model.title}</h1>
            <p className="board-clock">{model.clock?.time}</p>
            <p className="board-day">
              {model.clock?.day} · {model.updated}
            </p>
            {offline ? (
              <p role="status" className="board-sub">
                {t('live.offlineKept')}
              </p>
            ) : null}
          </header>
        </div>
        {stops ? <Takeaway data={stops} /> : null}
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
          {model.columns.map((column) => (
            <Column key={column.column} column={column} />
          ))}
        </div>
        <Foot model={model} />
      </main>
    );
  return <BrowserBoard model={model} tabs={tabs} />;
}
