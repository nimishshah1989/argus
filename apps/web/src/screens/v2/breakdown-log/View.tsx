/* eslint-disable i18next/no-literal-string -- sort keys, entity kinds and typed unions only; every visible word comes from the model */
import { tidyCell } from '../../../ui/v2/table-look.js';
import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { DOC_REF } from '@uptimo/shared/doc-ref';
import type { Sheet } from '@uptimo/shared/xlsx';
import { fill } from '../../../i18n/fill.js';
import type { Column } from '../../../ui/v2/data-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { DownloadExcel } from '../../../ui/v2/download-excel.js';
import { EntityChip, EntityOpenContext } from '../../../ui/v2/entity-chip.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { PagedTable, type SelectFilter } from '../../../ui/v2/paged-table.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { shortDate } from '../printed-page/printed.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import {
  type LogFilterId,
  type LogModel,
  type LogQuery,
  type LogRow,
  type LogSortKey,
} from './model.js';

const FILTERS: LogFilterId[] = ['date', 'month', 'shift', 'machine', 'code', 'person'];
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** `2026-11` as `Nov 2026`: a month option reads the way the date column prints its month. */
const monthLabel = (value: string): string => {
  const [year, month] = value.split('-');
  return `${MONTH_NAMES[Number(month) - 1] ?? ''} ${year ?? ''}`.trim();
};

/** The platform's eye: the ticket number opens the row's own ticket, the one the engine printed beside it. */
function TicketLink({ row, label }: { row: LogRow; label: string }) {
  if (row.ticketId === null) return <span className="v2-num">{row.ticket}</span>;
  return (
    <Link
      className="v2-ref v2-num"
      to={`/desk/${encodeURIComponent(row.ticketId)}`}
      // The name must contain the visible text (WCAG 2.5.3): the ticket number first, then what the link does.
      aria-label={`${row.ticket}: ${fill(label, { srNo: row.srNo })}`}
      onClick={(e) => e.stopPropagation()}
    >
      {row.ticket}
    </Link>
  );
}

const chips = (people: LogRow['doneBy']) => (
  <div className="v2-row v2-gap-6">
    {people.map((p) => (
      <EntityChip key={p.id} {...p} />
    ))}
  </div>
);

/** Who did the job; under them, when anyone did, who supported it (Bhavin's 11 Nov detail view). */
function DoneBy({ row, words }: { row: LogRow; words: LogModel['words'] }) {
  return (
    <>
      {row.doneBy.length === 0 ? <span className="v2-sub">{words.nobody}</span> : chips(row.doneBy)}
      {row.supportedBy.length === 0 ? null : (
        <div className="v2-row v2-gap-6">
          <span className="v2-sub">{words.supportedBy}</span>
          {chips(row.supportedBy)}
        </div>
      )}
    </>
  );
}

/** The hours as printed; only the exceptions carry a tag, with an icon and a word (never colour alone). */
function Hours({ row, words }: { row: LogRow; words: LogModel['words'] }) {
  if (row.severity === null) return <>{tidyCell(row.hours, 'hours')}</>;
  return (
    <span className="v2-num-tag" data-severity={row.severity}>
      <KeyPill
        text={row.severity === 'long' ? words.long : words.watch}
        tone={row.severity === 'long' ? 'loss' : 'risk'}
        icon={row.severity === 'long' ? 'alert' : 'clock'}
      />
      {tidyCell(row.hours, 'hours')}
    </span>
  );
}

/** The code as a badge that says what it means; PM is its own planned-work tag. Its type (E, M, E/M) sits under it. */
function CodeBadge({ row, words }: { row: LogRow; words: LogModel['words'] }) {
  if (row.code === '—') return <>—</>;
  const meaning = row.codeLabel ?? '';
  const named = meaning === '' ? row.code : `${row.code}: ${meaning}`;
  return (
    <div title={named}>
      <KeyPill
        text={row.code}
        tone={row.code === 'PM' ? 'plan' : 'neutral'}
        icon={row.code === 'PM' ? 'wrench' : undefined}
      />
      {meaning === '' ? null : <span className="v2-sr">{`: ${meaning}`}</span>}
      {row.type === '' ? null : <div className="v2-sub">{`${words.type} ${row.type}`}</div>}
    </div>
  );
}

function columns(model: LogModel): Column<LogRow>[] {
  const c = model.words.columns;
  const sortable = (key: LogSortKey) => ({ key, label: c[key], sortBy: () => 0 });
  return [
    { ...sortable('srNo'), numeric: true, look: 'plain', cell: (r) => r.srNo },
    { ...sortable('ticket'), cell: (r) => <TicketLink row={r} label={model.words.openTicket} /> },
    { ...sortable('date'), cell: (r) => r.date },
    { ...sortable('shift'), look: 'category', cell: (r) => r.shift },
    { ...sortable('machine'), cell: (r) => <EntityChip {...r.machine} /> },
    { ...sortable('problem'), cell: (r) => r.problem },
    { ...sortable('doneBy'), cell: (r) => <DoneBy row={r} words={model.words} /> },
    {
      ...sortable('hours'),
      numeric: true,
      look: 'loss',
      unit: 'hours',
      // The value scales the hours bar; the server still does the sorting.
      sortBy: (r) => Number(r.hours),
      cell: (r) => (r.severity === null ? r.hours : <Hours row={r} words={model.words} />),
    },
    { ...sortable('code'), cell: (r) => <CodeBadge row={r} words={model.words} /> },
  ];
}

const codeOption = (model: LogModel, code: string): string => {
  const label = model.codeLabels[code];
  return label === undefined ? code : fill(model.words.codeOption, { code, label });
};

/** The six exact filters, each offering only the values the engine printed. */
function selectsOf(model: LogModel, change: (q: Partial<LogQuery>) => void): SelectFilter[] {
  return FILTERS.map((id) => ({
    key: id,
    label: model.words.filters[id],
    all: model.words.all,
    value: model.query.filters[id],
    options: model.options[id],
    // A date is filtered by the day the engine printed and read the way the column prints it; a month with its year
    // (Bhavin's filter had none); a code with what it means.
    ...(id === 'date' ? { labelOf: shortDate } : {}),
    ...(id === 'month' ? { labelOf: monthLabel } : {}),
    ...(id === 'code' ? { labelOf: (code: string) => codeOption(model, code), compact: true } : {}),
    onChange: (value: string) => change({ filters: { ...model.query.filters, [id]: value } }),
  }));
}

/** The export of the whole narrowed log, with its refusal said in place. */
function ExportBar({ model, sheets }: { model: LogModel; sheets: Sheet[] }) {
  if (model.matching === 0) return null;
  return (
    <div className="v2-table-selects">
      <DownloadExcel
        file={`breakdown-log-${new Date().toISOString().slice(0, 10)}`}
        sheets={sheets}
        docRef={DOC_REF.breakdowns}
      />
    </div>
  );
}

function LogTable({
  model,
  loading,
  onQuery,
  sheets,
}: {
  model: LogModel;
  loading: boolean;
  onQuery: (query: LogQuery) => void;
  sheets: Sheet[];
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
      extra={<ExportBar model={model} sheets={sheets} />}
      foot={
        model.matching === model.count && model.truncated === null ? null : (
          <>
            {model.matching === model.count ? null : (
              <p className="v2-sub v2-pad">
                {fill(model.words.whole, { count: model.countShown })}
              </p>
            )}
            {model.truncated === null ? null : <p className="v2-sub v2-pad">{model.truncated}</p>}
          </>
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
  sheets,
}: {
  model: LogModel;
  loading?: boolean;
  nav: NavItem[];
  title: string;
  onQuery: (query: LogQuery) => void;
  sheets: Sheet[];
}) {
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      <LogTable model={model} loading={loading} onQuery={onQuery} sheets={sheets} />
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
