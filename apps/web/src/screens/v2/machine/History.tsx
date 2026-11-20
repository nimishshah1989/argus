/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import { useEffect, useRef } from 'react';
import { fill } from '../../../i18n/fill.js';
import { Button } from '../../../ui/v2/button.js';
import { DataTable, type Column, type FilterChip } from '../../../ui/v2/data-table.js';
import { EntityChip } from '../../../ui/v2/entity-chip.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Points } from '../../../ui/v2/points.js';
import type { BreakdownRow, HistoryWords } from './model.js';

/** Tags side by side: what kind of breakdown it was, in words as well as colour. */
function Tags({ row }: { row: BreakdownRow }) {
  return (
    <div className="v2-row v2-gap-6">
      {row.tags.map((t) => (
        <KeyPill key={t.text} {...t} />
      ))}
    </div>
  );
}

function columns(words: HistoryWords): Column<BreakdownRow>[] {
  const c = words.columns;
  return [
    { key: 'date', label: c.date, sortBy: (r) => r.date.iso, cell: (r) => r.date.shown },
    { key: 'problem', label: c.problem, sortBy: (r) => r.problem, cell: (r) => r.problem },
    {
      key: 'who',
      label: c.who,
      sortBy: (r) => r.who.label,
      cell: (r) => <EntityChip {...r.who} />,
    },
    {
      key: 'hours',
      label: c.hours,
      numeric: true,
      sortBy: (r) => r.hours.value,
      cell: (r) => r.hours.shown,
    },
    { key: 'result', label: c.result, cell: (r) => <Tags row={r} /> },
  ];
}

function filters(words: HistoryWords): FilterChip<BreakdownRow>[] {
  const f = words.filters;
  return [
    { key: 'all', label: f.all },
    { key: 'last90', label: f.last90, test: (r) => r.days <= 89 },
    { key: 'repeat', label: f.repeat, test: (r) => r.flags.repeat },
    { key: 'waited', label: f.waited, test: (r) => r.flags.waited },
  ];
}

/** The story of the breakdown that is open; focus moves here when it opens so a keyboard reader lands on it. */
function Detail({
  row,
  words,
  onClose,
}: {
  row: BreakdownRow;
  words: HistoryWords;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), [row.key]);
  return (
    <div ref={ref} tabIndex={-1}>
      <Panel
        title={fill(words.detailTitle, { date: row.date.shown, problem: row.problem })}
        aside={<Button onClick={onClose}>{words.close}</Button>}
      >
        <Tags row={row} />
        <Points points={row.story} />
      </Panel>
    </div>
  );
}

/** Every breakdown of the last 12 months, ten to a page, newest first; a row opens its story under the table. */
export function History({
  rows,
  words,
  open,
  onOpen,
}: {
  rows: BreakdownRow[];
  words: HistoryWords;
  open: string | undefined;
  onOpen: (key: string | undefined) => void;
}) {
  const shown = rows.find((r) => r.key === open);
  return (
    <>
      <DataTable
        rows={rows}
        rowKey={(r) => r.key}
        columns={columns(words)}
        filters={filters(words)}
        text={(r) =>
          `${r.date.shown} ${r.problem} ${r.who.label} ${r.tags.map((t) => t.text).join(' ')}`
        }
        words={words}
        initialSort={{ key: 'date', dir: 'desc' }}
        selected={open}
        onOpen={(r) => onOpen(r.key === open ? undefined : r.key)}
      />
      {shown ? <Detail row={shown} words={words} onClose={() => onOpen(undefined)} /> : null}
    </>
  );
}
