/* eslint-disable i18next/no-literal-string -- template kind, state and variant are prop values, not copy */
import { useState, type ReactNode } from 'react';
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
              {filterOptions(rows, filter.column).map((option) => (
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
  ids,
  resetKey,
}: {
  table: PageTable;
  shown: ReturnType<typeof filterRows>;
  ids: readonly string[];
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
        const ticketId = ids[index];
        if (column !== 0 || ticketId === undefined) return cell;
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
  | { state: 'ready'; title: string; table: PageTable; ids: readonly string[] };

/** What the figure gives this screen: an honest notice, or the page's one table. */
function logPageOf(figure: Figure | undefined, t: TFunction): LogPage {
  if (figure === undefined || figure.status !== 'ready') return { state: 'notComputed' };
  const content = contentOf(figure, t);
  if (content?.kind !== 'page') return { state: 'empty' };
  const table = content.tables[0];
  if (table === undefined || table.rows.length === 0) return { state: 'empty' };
  return { state: 'ready', title: content.title, table, ids: figure.drill.ids };
}

interface LogProps {
  figure: Figure | undefined;
  /** The group's screen menu, above the title. */
  menu: ReactNode;
  /** The line under the title: the date the records run to. */
  asOf: string;
  /** The rows behind a figure the page was opened from, above the log. */
  drill: ReactNode;
}

/**
 * The Breakdown Log on the register template: the platform's whole log, PM rows included, newest first, 50 rows to a
 * page. The eye opens the row's ticket, the filters narrow the rows and never the rowCount, and the export writes the
 * filtered table. A NO DT row prints the engine's dash as it came.
 */
export function BreakdownLog({ figure, menu, asOf, drill }: LogProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<LogFilters>(EMPTY_FILTERS);
  const page = logPageOf(figure, t);
  const lede = `${t('analytics.asOf', { date: asOf })} · ${t('analytics.log.intro')}`;
  if (page.state !== 'ready')
    return (
      <Template
        kind="register"
        trail={menu}
        title={t('analytics.screen.breakdown-log')}
        lede={lede}
        state="empty"
        empty={t(page.state === 'notComputed' ? 'analytics.notComputed' : 'analytics.log.empty')}
        main={null}
      />
    );
  const { title, table, ids } = page;
  const shown = filterRows(table.rows, filters);
  const active = LOG_FILTERS.some((filter) => filters[filter.id] !== '');
  const key = LOG_FILTERS.map((filter) => filters[filter.id]).join('|');
  return (
    <Template
      kind="register"
      trail={menu}
      title={title === '' ? t('analytics.screen.breakdown-log') : title}
      lede={lede}
      actions={<ExportButton table={table} rows={shown.map((entry) => entry.row)} />}
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
        <>
          {drill === null ? null : <div data-span="full">{drill}</div>}
          {shown.length === 0 ? (
            <EmptyState title={t('analytics.log.noMatches')} />
          ) : (
            <LogTable table={table} shown={shown} ids={ids} resetKey={key} />
          )}
        </>
      }
    />
  );
}
