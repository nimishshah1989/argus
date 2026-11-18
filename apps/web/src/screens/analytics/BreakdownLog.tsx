import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { Button } from '../../ui/button.js';
import { Download } from '../../ui/icon.js';
import { Label, Select } from '../../ui/input.js';
import { Stack } from '../../ui/layout.js';
import { DataTable } from './parts.js';
import { contentOf, type FigureContent } from './figure-content.js';
import {
  EMPTY_FILTERS,
  LOG_FILTERS,
  filterOptions,
  filterRows,
  logCsv,
  type LogFilters,
} from './log-values.js';

type Figure = FiguresReply['figures'][number];
type PageTable = Extract<FigureContent, { kind: 'page' }>['tables'][number];
type ShownRow = { row: readonly string[]; index: number };

const whole = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

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

function ExportButton({
  table,
  rows,
  disabled,
}: {
  table: PageTable;
  rows: readonly (readonly string[])[];
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
        variant="secondary"
        onClick={() => {
          setFailed(false);
          try {
            download(table, rows);
          } catch {
            setFailed(true);
          }
        }}
        disabled={disabled}
      >
        <span className="inline-flex items-center gap-2">
          <Download aria-hidden size={18} />
          {t('analytics.log.export')}
        </span>
      </Button>
      {failed ? (
        <p role="alert" className="text-footnote font-medium text-danger-ink">
          {t('analytics.log.exportError')}
        </p>
      ) : null}
    </div>
  );
}

/** One filter: only the values the engine's table already holds, with an "All" choice. */
function FilterField({
  filter,
  rows,
  value,
  onChange,
}: {
  filter: (typeof LOG_FILTERS)[number];
  rows: PageTable['rows'];
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const id = `log-filter-${filter.id}`;
  return (
    <div className="flex min-w-40 flex-col gap-1">
      <Label htmlFor={id}>{t(filter.labelKey)}</Label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{t('analytics.log.filter.all')}</option>
        {filterOptions(rows, filter.column).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** The four filters the ticket names, in the platform's column order. */
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
    <fieldset className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card">
      <legend className="px-1 text-body font-semibold">{t('analytics.log.filter.title')}</legend>
      <div className="flex flex-wrap gap-3">
        {LOG_FILTERS.map((filter) => (
          <FilterField
            key={filter.id}
            filter={filter}
            rows={rows}
            value={filters[filter.id]}
            onChange={(value) => onChange(filter.id, value)}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** The rowCount is always printed; a narrowed table adds how many rows matched it. */
function CountLine({
  table,
  shown,
  active,
}: {
  table: PageTable;
  shown: ShownRow[];
  active: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 text-footnote text-neutral-600">
      <p className="text-body font-medium text-neutral-900">
        {t('analytics.log.rows', { rows: whole.format(table.rowCount) })}
      </p>
      {table.rows.length < table.rowCount ? (
        <p>
          {t('analytics.log.truncated', {
            shown: whole.format(table.rows.length),
            total: whole.format(table.rowCount),
          })}
        </p>
      ) : null}
      {active ? (
        <p>{t('analytics.log.matching', { matching: whole.format(shown.length) })}</p>
      ) : null}
    </div>
  );
}

/** The eye column opens the row's own ticket; every other cell is the engine's own string. */
function LogTable({
  table,
  shown,
  ids,
}: {
  table: PageTable;
  shown: ShownRow[];
  ids: readonly string[];
}) {
  const { t } = useTranslation();
  return (
    <DataTable
      title={table.title === '' ? null : table.title}
      header={table.header}
      rows={shown.map((entry) => entry.row)}
      renderCell={(cell, rowIndex, columnIndex) => {
        const entry = shown[rowIndex];
        if (columnIndex !== 0 || entry === undefined) return cell;
        const ticketId = ids[entry.index];
        if (ticketId === undefined) return cell;
        return (
          <Link
            to={`/desk/${ticketId}`}
            aria-label={t('analytics.log.openTicket', { srNo: entry.row[1] ?? '' })}
            className="inline-flex min-h-target-min items-center font-semibold text-accent-text"
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

function Notice({ children }: { children: string }) {
  const { t } = useTranslation();
  return (
    <Stack gap={4}>
      <p className="max-w-3xl text-body text-neutral-600">{t('analytics.log.intro')}</p>
      <p className="text-body text-neutral-600">{children}</p>
    </Stack>
  );
}

/**
 * The Breakdown Log (packet 40e-1): the platform's whole log page, PM rows included, newest first. The eye opens
 * the row's ticket, the filters narrow the printed rows and never the rowCount, and the export writes the
 * filtered table under the existing client-export pattern. A NO DT row prints the engine's dash as it came.
 */
export function BreakdownLog({ figure }: { figure: Figure | undefined }) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<LogFilters>(EMPTY_FILTERS);
  const page = logPageOf(figure, t);
  if (page.state !== 'ready')
    return (
      <Notice>
        {t(page.state === 'notComputed' ? 'analytics.notComputed' : 'analytics.log.empty')}
      </Notice>
    );
  const { title, table, ids } = page;
  const shown = filterRows(table.rows, filters);
  const active = LOG_FILTERS.some((filter) => filters[filter.id] !== '');
  const update = (id: keyof LogFilters, value: string) =>
    setFilters((previous) => ({ ...previous, [id]: value }));
  return (
    <Stack gap={4}>
      {title === '' ? null : <h2 className="text-title3 font-semibold">{title}</h2>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-body text-neutral-600">{t('analytics.log.intro')}</p>
        <ExportButton
          table={table}
          rows={shown.map((entry) => entry.row)}
          disabled={shown.length === 0}
        />
      </div>
      <Filters rows={table.rows} filters={filters} onChange={update} />
      <CountLine table={table} shown={shown} active={active} />
      {shown.length === 0 ? (
        <p className="text-body text-neutral-600">{t('analytics.log.noMatches')}</p>
      ) : (
        <LogTable table={table} shown={shown} ids={ids} />
      )}
    </Stack>
  );
}
