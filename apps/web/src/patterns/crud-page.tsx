import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import { defineResource, idempotencyKey, useOnline, type ResourceSpec } from '../data/index.js';
import { Button } from '../ui/button.js';
import { Inline } from '../ui/layout.js';
import { FormSheet } from './form-sheet.js';
import { PatternFrame, StateNotice } from './frame.js';
import { viewState } from './view-state.js';

export type LabelKey = MessageKey | `gallery:${string}`;
export interface CrudRow {
  id: string;
  active: boolean;
}
export interface CrudField<Row> {
  name: keyof Row & string;
  labelKey: LabelKey;
  required?: boolean;
}
export interface CrudSpec<Row extends CrudRow> extends ResourceSpec {
  titleKey: LabelKey;
  emptyKey: LabelKey;
  /** Table columns (first = row header) and form fields. */
  fields: CrudField<Row>[];
}

function useCrud<Row extends CrudRow>(spec: CrudSpec<Row>) {
  const { t } = useTranslation();
  const resource = useMemo(() => defineResource<unknown, Row>(spec), [spec]);
  const list = resource.useList();
  const create = resource.useCreate();
  const update = resource.useUpdate();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const [sheet, setSheet] = useState<{ row: Row | null; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const valuesOf = (row: Row): Record<string, string> =>
    Object.fromEntries(spec.fields.map((f) => [f.name, String(row[f.name] ?? '')]));

  async function save(values: Record<string, string>): Promise<boolean> {
    setError(null);
    const row = sheet?.row;
    try {
      if (row) await update.mutateAsync({ id: row.id, body: { ...values, active: row.active } });
      else await create.mutateAsync({ body: values, idempotencyKey: sheet?.key });
      return true;
    } catch {
      setError(t('kit.crud.error'));
      return false;
    }
  }
  async function toggle(row: Row): Promise<void> {
    setError(null);
    try {
      await update.mutateAsync({ id: row.id, body: { ...valuesOf(row), active: !row.active } });
    } catch {
      setError(t('kit.crud.error'));
    }
  }
  const open = (row: Row | null) => {
    setError(null);
    setSheet({ row, key: idempotencyKey() });
  };
  return { list, items, sheet, setSheet, error, valuesOf, save, toggle, open, create, update };
}

function CrudTableRow<Row extends CrudRow>(p: {
  spec: CrudSpec<Row>;
  row: Row;
  onEdit: (row: Row) => void;
  onToggle: (row: Row) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const { row } = p;
  const [first, ...others] = p.spec.fields;
  const name = String(row[first!.name] ?? '');
  return (
    <tr className="border-t border-neutral-200 lg:h-13">
      <th scope="row" className="p-2 font-medium lg:px-3">
        {name}
      </th>
      {others.map((f) => (
        <td key={f.name} className="p-2 lg:px-3">
          {String(row[f.name] ?? '')}
        </td>
      ))}
      <td className="p-2 lg:px-3">{row.active ? t('kit.crud.on') : t('kit.crud.off')}</td>
      <td className="p-2 lg:px-3">
        <Inline gap={2}>
          <Button
            // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
            variant="secondary"
            aria-label={t('kit.crud.editRow', { name })}
            onClick={() => p.onEdit(row)}
          >
            {t('kit.crud.edit')}
          </Button>
          <Button
            // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
            variant="secondary"
            disabled={p.busy}
            aria-label={t(row.active ? 'kit.crud.switchOffRow' : 'kit.crud.switchOnRow', { name })}
            onClick={() => p.onToggle(row)}
          >
            {row.active ? t('kit.crud.switchOff') : t('kit.crud.switchOn')}
          </Button>
        </Inline>
      </td>
    </tr>
  );
}

function CrudTable<Row extends CrudRow>(p: {
  spec: CrudSpec<Row>;
  rows: Row[];
  onEdit: (row: Row) => void;
  onToggle: (row: Row) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto lg:rounded-2xl lg:bg-surface lg:shadow-card">
      <table className="w-full text-left text-footnote">
        <thead>
          <tr>
            {p.spec.fields.map((f) => (
              <th
                key={f.name}
                scope="col"
                className="p-2 font-medium text-neutral-600 lg:p-3 lg:text-caption lg:font-semibold"
              >
                {t(f.labelKey)}
              </th>
            ))}
            {}
            <th
              scope="col"
              className="p-2 font-medium text-neutral-600 lg:p-3 lg:text-caption lg:font-semibold"
            >
              {t('kit.crud.status')}
            </th>
            <th scope="col" className="p-2 lg:p-3">
              <span className="sr-only">{t('kit.crud.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {p.rows.map((row) => (
            <CrudTableRow
              key={row.id}
              spec={p.spec}
              row={row}
              onEdit={p.onEdit}
              onToggle={p.onToggle}
              busy={p.busy}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A settings page generated from one `CrudSpec`: list, add, edit, switch off and on; never delete. */
export function CrudPage<Row extends CrudRow>({ spec }: { spec: CrudSpec<Row> }) {
  const { t } = useTranslation();
  const online = useOnline();
  const c = useCrud(spec);
  const state = viewState({
    online,
    hasData: c.list.data !== undefined,
    isEmpty: c.items.length === 0,
    error: c.list.error,
  });
  const row = c.sheet?.row ?? null;
  return (
    <PatternFrame title={t(spec.titleKey)}>
      <Button onClick={() => c.open(null)}>{t('kit.crud.add')}</Button>
      {!c.sheet && c.error ? (
        <p role="alert" className="text-body font-medium text-neutral-900">
          {c.error}
        </p>
      ) : null}
      {state === 'ready' ? (
        <CrudTable
          spec={spec}
          rows={c.items}
          onEdit={c.open}
          onToggle={(r) => void c.toggle(r)}
          busy={c.update.isPending}
        />
      ) : (
        <StateNotice state={state} empty={t(spec.emptyKey)} onRetry={() => void c.list.refetch()} />
      )}
      {c.sheet ? (
        <FormSheet
          open
          onOpenChange={(o) => {
            if (!o) c.setSheet(null);
          }}
          title={
            row
              ? t('kit.crud.editTitle', { name: c.valuesOf(row)[spec.fields[0]!.name] })
              : t('kit.crud.add')
          }
          submitLabel={t('kit.crud.save')}
          fields={spec.fields.map((f) => ({
            name: f.name,
            label: t(f.labelKey),
            required: f.required,
          }))}
          initial={row ? c.valuesOf(row) : {}}
          offlineAllowed={false}
          pending={c.create.isPending || c.update.isPending}
          error={c.error}
          onSubmit={c.save}
        />
      ) : null}
    </PatternFrame>
  );
}
