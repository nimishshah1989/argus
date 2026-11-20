/* eslint-disable i18next/no-literal-string -- sort keys, entity kinds and typed unions only; every visible word comes from the model */
import { useContext, useState } from 'react';
import { fill } from '../../../i18n/fill.js';
import { Button } from '../../../ui/v2/button.js';
import type { Column } from '../../../ui/v2/data-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { EntityChip, EntityOpenContext } from '../../../ui/v2/entity-chip.js';
import { PagedTable, type SelectFilter } from '../../../ui/v2/paged-table.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import {
  type LogFilterId,
  type LogModel,
  type LogQuery,
  type LogRow,
  type LogSortKey,
} from './model.js';

const FILTERS: LogFilterId[] = ['date', 'shift', 'machine', 'code'];

/** The platform's eye: the ticket number opens the row's own ticket, the one the engine printed beside it. */
function TicketLink({ row, label }: { row: LogRow; label: string }) {
  if (row.ticketId === null) return <span className="v2-num">{row.ticket}</span>;
  return (
    <a
      className="v2-ref v2-num"
      href={`/desk/${encodeURIComponent(row.ticketId)}`}
      aria-label={fill(label, { srNo: row.srNo })}
      onClick={(e) => e.stopPropagation()}
    >
      {row.ticket}
    </a>
  );
}

function columns(model: LogModel): Column<LogRow>[] {
  const c = model.words.columns;
  const sortable = (key: LogSortKey) => ({ key, label: c[key], sortBy: () => 0 });
  return [
    { ...sortable('srNo'), numeric: true, cell: (r) => r.srNo },
    { ...sortable('ticket'), cell: (r) => <TicketLink row={r} label={model.words.openTicket} /> },
    { ...sortable('date'), cell: (r) => r.date },
    { ...sortable('shift'), cell: (r) => r.shift },
    { ...sortable('machine'), cell: (r) => <EntityChip {...r.machine} /> },
    { ...sortable('problem'), cell: (r) => r.problem },
    {
      ...sortable('doneBy'),
      cell: (r) =>
        r.doneBy.length === 0 ? (
          <span className="v2-sub">{model.words.nobody}</span>
        ) : (
          <div className="v2-row v2-gap-6">
            {r.doneBy.map((p) => (
              <EntityChip key={p.id} {...p} />
            ))}
          </div>
        ),
    },
    { ...sortable('hours'), numeric: true, cell: (r) => r.hours },
    { ...sortable('code'), cell: (r) => r.code },
  ];
}

/** The four exact filters, each offering only the values the engine printed. */
function selectsOf(model: LogModel, change: (q: Partial<LogQuery>) => void): SelectFilter[] {
  return FILTERS.map((id) => ({
    key: id,
    label: model.words.filters[id],
    all: model.words.all,
    value: model.query.filters[id],
    options: model.options[id],
    onChange: (value: string) => change({ filters: { ...model.query.filters, [id]: value } }),
  }));
}

/** The export of the whole narrowed log, with its refusal said in place. */
function ExportBar({ model, onExport }: { model: LogModel; onExport: () => Promise<void> }) {
  const [failed, setFailed] = useState(false);
  if (model.matching === 0) return null;
  return (
    <div className="v2-table-selects">
      <Button
        onClick={() => {
          setFailed(false);
          onExport().catch(() => setFailed(true));
        }}
      >
        {model.words.export}
      </Button>
      {failed ? (
        <p role="alert" className="v2-sub">
          {model.words.exportError}
        </p>
      ) : null}
    </div>
  );
}

function LogTable({
  model,
  loading,
  onQuery,
  onExport,
}: {
  model: LogModel;
  loading: boolean;
  onQuery: (query: LogQuery) => void;
  onExport: () => Promise<void>;
}) {
  const open = useContext(EntityOpenContext);
  const { current } = useEntityParam();
  const q = model.query;
  const change = (next: Partial<LogQuery>) => onQuery({ ...q, page: 1, ...next });
  return (
    <PagedTable
      rows={model.rows}
      rowKey={(r) => r.id}
      columns={columns(model)}
      filters={[{ key: 'all', label: model.words.all }]}
      chip="all"
      onChip={() => {}}
      query={q.query}
      onQuery={(query) => change({ query })}
      sort={q.sort ? { key: q.sort.key, dir: q.sort.dir } : undefined}
      onSort={(s) => change({ sort: { key: s.key as LogSortKey, dir: s.dir } })}
      selects={selectsOf(model, change)}
      page={q.page}
      total={model.matching}
      onPage={(page) => onQuery({ ...q, page })}
      loading={loading}
      words={model.words.table}
      selected={current?.kind === 'machine' ? current.id : undefined}
      onOpen={(r) => open({ kind: 'machine', id: r.machine.id })}
      extra={<ExportBar model={model} onExport={onExport} />}
      foot={
        model.matching === model.count ? null : (
          <p className="v2-sub v2-pad">{fill(model.words.whole, { count: model.countShown })}</p>
        )
      }
    />
  );
}

/**
 * The Breakdown Log: the answer first, then the log ten entries at a time. Every search, sort, filter and page is
 * asked of the server (`onQuery`), which sends that page and the counts; the screen never holds more than ten rows.
 * A machine or a person is a chip, a ticket number opens its ticket, and the export writes the whole narrowed log.
 */
export function BreakdownLogView({
  model,
  loading = false,
  nav,
  title,
  onQuery,
  onExport,
}: {
  model: LogModel;
  loading?: boolean;
  nav: NavItem[];
  title: string;
  onQuery: (query: LogQuery) => void;
  onExport: () => Promise<void>;
}) {
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      <LogTable model={model} loading={loading} onQuery={onQuery} onExport={onExport} />
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
