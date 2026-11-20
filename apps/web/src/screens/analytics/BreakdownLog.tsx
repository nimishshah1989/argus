/* eslint-disable i18next/no-literal-string -- template kind, state and variant are prop values, not copy */
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { Button } from '../../ui/button.js';
import { EmptyState } from '../../ui/elements/index.js';
import { Download } from '../../ui/icon.js';
import { Label, Select } from '../../ui/input.js';
import { Template } from './shell/patterns/template.js';
import { EngineTable } from './engine-table.js';
import { contentOf, type FigureContent } from './figure-content.js';
import {
  DATE_COLUMN,
  EMPTY_FILTERS,
  LOG_FILTERS,
  dayKey,
  filterOptions,
  filterRows,
  logCsv,
  type LogFilters,
} from './log-values.js';

type Figure = FiguresReply['figures'][number];
type PageTable = Extract<FigureContent, { kind: 'page' }>['tables'][number];

const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
/** The log's own rows are many; a page paints this many at most. */
const PAGE_ROWS = 50;
const UNSORTED = new Set([0]);

/** The client-export pattern (39b): a Blob, a link and the browser's download, with no new dependency. */
function download(table: PageTable, rows: readonly (readonly string[])[]) {
  const blob = new Blob([logCsv(table.header, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `breakdown-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ExportButton({ table, rows }: { table: PageTable; rows: readonly (readonly string[])[] }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  return (
    <div className="rg-stack">
      <Button
        variant="secondary"
        onClick={() => {
          setFailed(false);
          try {
            download(table, rows);
          } catch {
            setFailed(true);
          }
        }}
        disabled={rows.length === 0}
      >
        <span className="rg-icon-label">
          <Download aria-hidden size={18} />
          {t('analytics.log.export')}
        </span>
      </Button>
      {failed ? (
        <p role="alert" className="rg-note">
          {t('analytics.log.exportError')}
        </p>
      ) : null}
    </div>
  );
}

/** The four filters the ticket names, each only the values the engine's table holds, with an "All" choice. */
function Filters({
  rows,
  filters,
  onChange,
}: {
  rows: PageTable['rows'];
  filters: LogFilters;
  onChange: (id: keyof LogFilters, value: string) => void;
}) {
  const { t } = useTranslation();
  const options = useMemo(
    () =>
      Object.fromEntries(
        LOG_FILTERS.map((filter) => [filter.id, filterOptions(rows, filter.column)]),
      ) as Record<keyof LogFilters, string[]>,
    [rows],
  );
  return (
    <fieldset className="rg-filters">
      <legend className="sr-only">{t('analytics.log.filter.title')}</legend>
      {LOG_FILTERS.map((filter) => {
        const id = `log-filter-${filter.id}`;
        return (
          <div key={filter.id}>
            <Label htmlFor={id}>{t(filter.labelKey)}</Label>
            <Select
              id={id}
              value={filters[filter.id]}
              onChange={(event) => onChange(filter.id, event.target.value)}
            >
              <option value="">{t('analytics.log.filter.all')}</option>
              {options[filter.id].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        );
      })}
    </fieldset>
  );
}

/** The rowCount is always printed; a narrowed table adds how many rows matched it. */
function CountLine({
  table,
  matching,
  active,
}: {
  table: PageTable;
  matching: number;
  active: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="rg-counts">
      <p>
        <strong>{t('analytics.log.rows', { rows: whole.format(table.rowCount) })}</strong>
      </p>
      {table.rows.length < table.rowCount ? (
        <p>
          {t('analytics.log.truncated', {
            shown: whole.format(table.rows.length),
            total: whole.format(table.rowCount),
          })}
        </p>
      ) : null}
      {active ? <p>{t('analytics.log.matching', { matching: whole.format(matching) })}</p> : null}
    </div>
  );
}

/** The eye column opens the row's own ticket; every other cell is the engine's own string. */
function LogTable({
  table,
  shown,
  resetKey,
}: {
  table: PageTable;
  shown: ReturnType<typeof filterRows>;
  resetKey: string;
}) {
  const { t } = useTranslation();
  return (
    <EngineTable
      caption={t('analytics.log.caption')}
      header={table.header.map((label, column) =>
        column === 0 ? t('analytics.log.ticketColumn') : label,
      )}
      rows={shown}
      pageSize={PAGE_ROWS}
      resetKey={resetKey}
      unsortable={UNSORTED}
      sortKey={(column, cell) => (column === DATE_COLUMN ? dayKey(cell) : undefined)}
      renderCell={(cell, index, column) => {
        // The drill ids are sorted, not in row order: the row's own ticket is the one the figure printed beside it.
        const ticketId = table.rowTicketIds?.[index];
        if (column !== 0 || ticketId === undefined || ticketId === '') return cell;
        return (
          <Link
            to={`/desk/${ticketId}`}
            aria-label={t('analytics.log.openTicket', { srNo: table.rows[index]?.[1] ?? '' })}
            className="rg-link"
          >
            {cell}
          </Link>
        );
      }}
    />
  );
}

type LogPage =
  | { state: 'notComputed' }
  | { state: 'empty' }
  | { state: 'ready'; title: string; table: PageTable };

/** What the figure gives this screen: an honest notice, or the page's one table. */
function logPageOf(figure: Figure | undefined, t: TFunction): LogPage {
  if (figure === undefined || figure.status !== 'ready') return { state: 'notComputed' };
  const content = contentOf(figure, t);
  if (content?.kind !== 'page') return { state: 'empty' };
  const table = content.tables[0];
  if (table === undefined || table.rows.length === 0) return { state: 'empty' };
  return { state: 'ready', title: content.title, table };
}

interface LogProps {
  figure: Figure | undefined;
  /** The group's screen menu, above the title. */
  menu: ReactNode;
  /** The line under the title: the date the records run to. */
  asOf: string;
  /** The rows behind a figure the page was opened from; they sit in the template's drill area. */
  drill: ReactNode;
}

/** The template's drill area, kept whatever the log is doing: a drill in the address always shows its rows. */
const drillSlot = (drill: ReactNode, title: string) =>
  drill === null ? {} : { drill, drillTitle: title };

/** The filters narrow the rows, the count says how many are left and the table pages them, 50 to a page. */
function LogReady({
  page,
  frame,
  drill,
  asOf,
}: {
  page: Extract<LogPage, { state: 'ready' }>;
  frame: ReactNode;
  drill: ReactNode;
  asOf: string;
}) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<LogFilters>(EMPTY_FILTERS);
  const { title, table } = page;
  const shown = useMemo(() => filterRows(table.rows, filters), [table.rows, filters]);
  const exported = useMemo(() => shown.map((entry) => entry.row), [shown]);
  const active = LOG_FILTERS.some((filter) => filters[filter.id] !== '');
  const key = LOG_FILTERS.map((filter) => filters[filter.id]).join('|');
  return (
    <Template
      kind="register"
      trail={frame}
      title={title === '' ? t('analytics.screen.breakdown-log') : title}
      lede={`${t('analytics.asOf', { date: asOf })} · ${t('analytics.log.intro')}`}
      actions={<ExportButton table={table} rows={exported} />}
      filters={
        <div className="rg-stack rg-wide">
          <Filters
            rows={table.rows}
            filters={filters}
            onChange={(id, value) => setFilters((previous) => ({ ...previous, [id]: value }))}
          />
          <CountLine table={table} matching={shown.length} active={active} />
        </div>
      }
      main={
        shown.length === 0 ? (
          <EmptyState title={t('analytics.log.noMatches')} />
        ) : (
          <LogTable table={table} shown={shown} resetKey={key} />
        )
      }
      {...drillSlot(drill, t('analytics.drill.title'))}
    />
  );
}

/**
 * The Breakdown Log on the register template: the platform's whole log, PM rows included, newest first, 50 rows to a
 * page. The eye opens the row's ticket, the filters narrow the rows and never the rowCount, and the export writes the
 * filtered table. A NO DT row prints the engine's dash as it came. The log is cut into pages in memory for now: the
 * reply carries every row (ruling in `docs/plan/ledger.md`, until 75b or a paged endpoint).
 */
export function BreakdownLog({ figure, menu, asOf, drill }: LogProps) {
  const { t } = useTranslation();
  const page = useMemo(() => logPageOf(figure, t), [figure, t]);
  if (page.state === 'ready')
    return <LogReady page={page} frame={menu} drill={drill} asOf={asOf} />;
  return (
    <Template
      kind="register"
      trail={menu}
      title={t('analytics.screen.breakdown-log')}
      lede={`${t('analytics.asOf', { date: asOf })} · ${t('analytics.log.intro')}`}
      main={
        <EmptyState
          title={t(page.state === 'notComputed' ? 'analytics.notComputed' : 'analytics.log.empty')}
        />
      }
      {...drillSlot(drill, t('analytics.drill.title'))}
    />
  );
}
