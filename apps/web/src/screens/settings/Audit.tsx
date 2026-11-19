/* eslint-disable i18next/no-literal-string -- routes, ids and prop values only; every visible string goes through t() */
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AUDIT_AREAS, type AuditArea, type AuditRow } from '@uptimo/shared/audit';
import type { PersonAdmin } from '@uptimo/shared/people';
import { getConfig, getMe } from '../../api.js';
import { formatDateTime } from '../../components/format.js';
import { defineResource, downloadFile, useOnline } from '../../data/index.js';
import { PatternFrame, StateNotice } from '../../patterns/frame.js';
import { viewState } from '../../patterns/view-state.js';
import { Button } from '../../ui/button.js';
import { FileCheck } from '../../ui/icon.js';
import { Input, Label, Select } from '../../ui/input.js';
import { Stack } from '../../ui/layout.js';

/** The nav entry; the screen is not a `CrudPage`, so `Plant.tsx` branches before it reads a spec. */
export const AUDIT_PAGE = { page: 'audit', icon: FileCheck, key: 'audit.menu' } as const;

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

function Change({ row, timeZone }: { row: AuditRow; timeZone?: string }) {
  const { t } = useTranslation();
  const reason = (row.after as { reason?: string } | null)?.reason;
  const area = AUDIT_AREAS.includes(row.entity as AuditArea)
    ? t(`audit.area.${row.entity}`)
    : humanise(row.entity);
  const shown = changes(row.before, row.after, t('audit.none'));
  return (
    <li className="flex flex-col gap-1 rounded-card bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-body font-semibold">{humanise(row.action)}</p>
        <time dateTime={row.at} className="text-caption text-neutral-600">
          {formatDateTime(row.at, timeZone)}
        </time>
      </div>
      <p className="text-footnote text-neutral-600">
        {area} · {t('audit.by', { name: row.actor?.name ?? t('audit.system') })}
      </p>
      {reason ? (
        <p className="text-footnote text-neutral-900">
          {t('audit.reason')}: {reason}
        </p>
      ) : null}
      {shown.length > 0 ? (
        <dl className="flex flex-col gap-1 text-footnote">
          {shown.map(({ key, from, to }) => (
            <div key={key} className="flex flex-wrap gap-2">
              <dt className="font-semibold">{humanise(key)}</dt>
              <dd className="text-neutral-600">
                {from} → {to}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-footnote text-neutral-600">{t('audit.noValues')}</p>
      )}
    </li>
  );
}

function Field(p: { id: string; label: string; children: ReactNode }) {
  return (
    <Stack gap={1}>
      <Label htmlFor={p.id}>{p.label}</Label>
      {p.children}
    </Stack>
  );
}

function FiltersBar(p: {
  filters: Filters;
  admin: boolean;
  people: PersonAdmin[];
  onChange: (filters: Filters) => void;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<Filters>) => p.onChange({ ...p.filters, ...patch });
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field id="audit-area" label={t('audit.area')}>
        <Select
          id="audit-area"
          value={p.filters.area}
          onChange={(event) => set({ area: event.target.value })}
        >
          <option value="">{t('audit.allAreas')}</option>
          {AUDIT_AREAS.map((area) => (
            <option key={area} value={area}>
              {t(`audit.area.${area}`)}
            </option>
          ))}
        </Select>
      </Field>
      {p.admin ? (
        <Field id="audit-person" label={t('audit.person')}>
          <Select
            id="audit-person"
            value={p.filters.personId}
            onChange={(event) => set({ personId: event.target.value })}
          >
            <option value="">{t('audit.allPeople')}</option>
            {p.people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field id="audit-from" label={t('audit.from')}>
        <Input
          id="audit-from"
          type="date"
          value={p.filters.from}
          onChange={(event) => set({ from: event.target.value })}
        />
      </Field>
      <Field id="audit-to" label={t('audit.to')}>
        <Input
          id="audit-to"
          type="date"
          value={p.filters.to}
          onChange={(event) => set({ to: event.target.value })}
        />
      </Field>
    </div>
  );
}

async function downloadCsv(filters: Filters): Promise<void> {
  const params = new URLSearchParams(queryOf(filters)).toString();
  await downloadFile(
    `/api/v1/audit.csv${params ? `?${params}` : ''}`,
    `audit-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

function NoAccess() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 pt-8 text-center">
      <h2 className="text-title2 font-extrabold">{t('audit.noAccess')}</h2>
      <p className="text-body text-neutral-600">{t('audit.noAccess.body')}</p>
    </div>
  );
}

/** The page and its filters as one query: paging resets when a filter changes. */
function useTrail(filters: Filters) {
  const list = audit.useList(queryOf(filters));
  const rows = list.data?.pages.flatMap((page) => page.items) ?? [];
  const state = viewState({
    online: useOnline(),
    hasData: list.data !== undefined,
    isEmpty: rows.length === 0,
    error: list.error,
  });
  return { list, rows, state };
}

function Trail(p: { trail: ReturnType<typeof useTrail>; timeZone?: string }) {
  const { t } = useTranslation();
  const { list, rows, state } = p.trail;
  if (state !== 'ready')
    return (
      <StateNotice state={state} empty={t('audit.empty')} onRetry={() => void list.refetch()} />
    );
  return (
    <>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <Change key={row.id} row={row} timeZone={p.timeZone} />
        ))}
      </ul>
      {list.hasNextPage ? (
        <Button
          variant="secondary"
          disabled={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          {t('audit.older')}
        </Button>
      ) : null}
    </>
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
      await downloadCsv(filters);
    } catch {
      setError(t('audit.exportFailed'));
    } finally {
      setExporting(false);
    }
  }
  return (
    <div>
      <Button onClick={() => void run()} disabled={exporting || !online}>
        {exporting ? t('audit.exporting') : t('audit.export')}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-body text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The audit trail (ticket 20 goal 2): admin and head read, filter by area/person/day; only admin exports. */
export function AuditSettings() {
  const { t } = useTranslation();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const role = me.data?.user.role;
  const admin = role === 'admin';
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const trail = useTrail(filters);
  const choices = useQuery({
    queryKey: ['people', 'audit-filter'],
    queryFn: async () => (await people.list()).items,
    enabled: admin,
  });
  if (role && role !== 'admin' && role !== 'head') return <NoAccess />;
  return (
    <PatternFrame title={t('audit.title')}>
      <p className="text-footnote text-neutral-600">{t('audit.intro')}</p>
      <FiltersBar
        filters={filters}
        admin={admin}
        people={choices.data ?? []}
        onChange={setFilters}
      />
      {admin ? <Export filters={filters} /> : null}
      <Trail trail={trail} timeZone={config.data?.timeZone} />
    </PatternFrame>
  );
}
