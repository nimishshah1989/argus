/* eslint-disable i18next/no-literal-string -- routes, ids and prop values only; every visible string goes through t() */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AUDIT_AREAS, type AuditArea, type AuditRow } from '@uptimo/shared/audit';
import type { PersonAdmin } from '@uptimo/shared/people';
import { getConfig, getMe } from '../../../api.js';
import { formatDateTime } from '../../../components/format.js';
import { defineResource, downloadFile, useOnline } from '../../../data/index.js';
import { viewState } from '../../../patterns/view-state.js';
import { DataTable, type Column } from '../../../ui/v2/data-table.js';
import { DateField } from '../../../ui/v2/date-field.js';
import { ScreenStates } from '../../../ui/v2/screen-states.js';
import { SelectField } from '../../../ui/v2/select-field.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { auditTakeaway, mayExport } from './model.js';

const audit = defineResource<AuditRow, AuditRow>({ key: 'audit', path: '/api/v1/audit' });
const people = defineResource<PersonAdmin, PersonAdmin>({ key: 'people', path: '/api/v1/people' });

interface Filters {
  area: string;
  personId: string;
  from: string;
  to: string;
}
const EMPTY: Filters = { area: '', personId: '', from: '', to: '' };
const queryOf = (filters: Filters): Record<string, string> =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));

/** The stored values as a diff: what the change touched, from its old value to its new one. */
function changes(before: unknown, after: unknown, none: string) {
  const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const [b, a] = [asRecord(before), asRecord(after)];
  const text = (value: unknown) =>
    value === null || value === undefined
      ? none
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  return [...new Set([...Object.keys(b), ...Object.keys(a)])]
    .filter((key) => key !== 'reason' && JSON.stringify(b[key]) !== JSON.stringify(a[key]))
    .map((key) => ({ key, from: text(b[key]), to: text(a[key]) }));
}

const humanise = (value: string): string => {
  const words = value
    .split(/[._-]+/)
    .filter(Boolean)
    .join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const reasonOf = (row: AuditRow) => (row.after as { reason?: string } | null)?.reason;

function FiltersBar(p: {
  filters: Filters;
  admin: boolean;
  people: PersonAdmin[];
  onChange: (filters: Filters) => void;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<Filters>) => p.onChange({ ...p.filters, ...patch });
  return (
    <div className="v2-table-selects">
      <SelectField
        label={t('audit.area')}
        all={t('audit.allAreas')}
        value={p.filters.area}
        options={AUDIT_AREAS.map((area) => ({ key: area, label: t(`audit.area.${area}`) }))}
        onChange={(area) => set({ area })}
      />
      {p.admin ? (
        <SelectField
          label={t('audit.person')}
          all={t('audit.allPeople')}
          value={p.filters.personId}
          options={p.people.map((person) => ({ key: person.id, label: person.name }))}
          onChange={(personId) => set({ personId })}
        />
      ) : null}
      <DateField
        label={t('audit.from')}
        value={p.filters.from}
        onChange={(from) => set({ from })}
      />
      <DateField label={t('audit.to')} value={p.filters.to} onChange={(to) => set({ to })} />
    </div>
  );
}

/** The admin-only export: the same filters, one bounded CSV answer. */
function Export({ filters }: { filters: Filters }) {
  const { t } = useTranslation();
  const online = useOnline();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(): Promise<void> {
    setError(null);
    setExporting(true);
    try {
      const params = new URLSearchParams(queryOf(filters)).toString();
      await downloadFile(
        `/api/v1/audit.csv${params ? `?${params}` : ''}`,
        `audit-${new Date().toISOString().slice(0, 10)}.csv`,
      );
    } catch {
      setError(t('audit.exportFailed'));
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="v2-stack v2-gap-6">
      <button
        type="button"
        className="v2-btn v2-btn-ghost"
        onClick={() => void run()}
        disabled={exporting || !online}
      >
        {exporting ? t('audit.exporting') : t('audit.export')}
      </button>
      {error ? (
        <p role="alert" className="v2-seg v2-seg-loss">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** One change's stored values, opened in place under its row. */
function Values({ row }: { row: AuditRow }) {
  const { t } = useTranslation();
  const shown = changes(row.before, row.after, t('audit.none'));
  if (shown.length === 0) return <p className="v2-sub">{t('audit.noValues')}</p>;
  return (
    <dl className="v2-stack v2-gap-6">
      {shown.map(({ key, from, to }) => (
        <div key={key} className="v2-row v2-gap-6">
          <dt>
            <strong>{humanise(key)}</strong>
          </dt>
          <dd className="v2-sub">
            {from} → {to}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The takeaway counts a whole 7 days, so it stays quiet while a filter or an unloaded page makes that partial. */
function Lead({
  rows,
  hasMore,
  filtered,
}: {
  rows: AuditRow[];
  hasMore: boolean;
  filtered: boolean;
}) {
  const { t } = useTranslation();
  const lead = filtered ? null : auditTakeaway(rows, hasMore, new Date());
  if (!lead) return null;
  const area = AUDIT_AREAS.includes(lead.area as AuditArea)
    ? t(`audit.area.${lead.area as AuditArea}`)
    : humanise(lead.area);
  return (
    <Takeaway
      data={{
        text: t(lead.by ? 'audit.takeaway.by' : 'audit.takeaway', { ...lead, area }),
        tone: 'neutral',
        tag: t('audit.tag'),
      }}
    />
  );
}

function Trail(p: { rows: AuditRow[]; timeZone?: string }) {
  const { t } = useTranslation();
  const areaOf = (row: AuditRow) =>
    AUDIT_AREAS.includes(row.entity as AuditArea)
      ? t(`audit.area.${row.entity as AuditArea}`)
      : humanise(row.entity);
  const byOf = (row: AuditRow) => row.actor?.name ?? t('audit.system');
  const columns: Column<AuditRow>[] = [
    {
      key: 'when',
      label: t('audit.col.when'),
      cell: (row) => <time dateTime={row.at}>{formatDateTime(row.at, p.timeZone)}</time>,
    },
    {
      key: 'what',
      label: t('audit.col.what'),
      cell: (row) => (
        <>
          <strong>{humanise(row.action)}</strong>
          {reasonOf(row) ? (
            <span className="v2-crud-sub">
              {t('audit.reason')}: {reasonOf(row)}
            </span>
          ) : null}
        </>
      ),
    },
    { key: 'area', label: t('audit.area'), cell: areaOf },
    { key: 'by', label: t('audit.col.by'), cell: byOf },
  ];
  return (
    <DataTable
      rows={p.rows}
      rowKey={(row) => row.id}
      rowLabel={(row) => humanise(row.action)}
      columns={columns}
      headed
      filters={[]}
      text={(row) => [humanise(row.action), areaOf(row), byOf(row), reasonOf(row)].join(' ')}
      expand={(row) => <Values row={row} />}
      words={{
        title: t('audit.title'),
        search: t('audit.search'),
        showing: t('v2m.showing'),
        noResults: t('v2m.noResults'),
        open: t('audit.reason'),
      }}
    />
  );
}

/** The audit trail: the last 7 days in one line, then the changes newest first. Admin and head read; only admin exports. */
export function AuditView() {
  const { t } = useTranslation();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const role = me.data?.user.role;
  const admin = role === 'admin';
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const choices = useQuery({
    queryKey: ['people', 'audit-filter'],
    queryFn: async () => (await people.list()).items,
    enabled: admin,
  });
  const list = audit.useList(queryOf(filters));
  const rows = list.data?.pages.flatMap((page) => page.items) ?? [];
  const state = viewState({
    online: useOnline(),
    hasData: list.data !== undefined,
    isEmpty: rows.length === 0,
    error: list.error,
  });
  return (
    <div className="v2-crud">
      <h2 className="v2-h2">{t('audit.title')}</h2>
      <Lead
        rows={rows}
        hasMore={list.hasNextPage}
        filtered={Object.keys(queryOf(filters)).length > 0}
      />
      <p className="v2-crud-hint">{t('audit.intro')}</p>
      <FiltersBar
        filters={filters}
        admin={admin}
        people={choices.data ?? []}
        onChange={setFilters}
      />
      {mayExport(role) ? <Export filters={filters} /> : null}
      <ScreenStates
        loaded={{ state, model: rows, retry: () => void list.refetch() }}
        emptyText={t('audit.empty')}
      >
        {(all) => (
          <>
            <Trail rows={all} timeZone={config.data?.timeZone} />
            {list.hasNextPage ? (
              <button
                type="button"
                className="v2-btn v2-btn-ghost"
                disabled={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {t('audit.older')}
              </button>
            ) : null}
          </>
        )}
      </ScreenStates>
    </div>
  );
}
