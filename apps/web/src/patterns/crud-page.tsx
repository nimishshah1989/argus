import { useMemo, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { defineResource, idempotencyKey, useOnline } from '../data/index.js';
import { Button } from '../ui/button.js';
import { Inline } from '../ui/layout.js';
import { CrudList } from './crud-list.js';
import type { CrudCtx, CrudRow, CrudSpec, Lookups } from './crud-spec.js';
import { FormSheet } from './form-sheet.js';
import { PatternFrame, StateNotice } from './frame.js';
import { viewState } from './view-state.js';

export type { CrudRow, CrudField, CrudSpec, LabelKey } from './crud-spec.js';

/** The lists a spec's choices and rows draw on, read once and cached under each resource's key. */
function useLookups<Row extends CrudRow>(spec: CrudSpec<Row>): Lookups {
  const entries = Object.entries(spec.lookups ?? {});
  const results = useQueries({
    queries: entries.map(([, source]) => ({
      queryKey: [source.key, 'lookup'],
      queryFn: async () => (await defineResource<unknown, unknown>(source).list()).items,
    })),
  });
  return Object.fromEntries(entries.map(([name], i) => [name, results[i]?.data ?? []]));
}

function useCrud<Row extends CrudRow>(spec: CrudSpec<Row>) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const resource = useMemo(() => defineResource<unknown, Row>(spec), [spec]);
  const lookups = useLookups(spec);
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
    const apart = spec.separate ?? {};
    const own = Object.fromEntries(Object.entries(values).filter(([k]) => !(k in apart)));
    try {
      if (!row) await create.mutateAsync({ body: values, idempotencyKey: sheet?.key });
      else {
        await update.mutateAsync({ id: row.id, body: { ...own, active: row.active } });
        for (const [name, send] of Object.entries(apart))
          if (name in values && values[name] !== valuesOf(row)[name])
            await send(row.id, values[name]!);
      }
      return true;
    } catch {
      setError(t('kit.crud.error'));
      return false;
    } finally {
      if (row) await client.invalidateQueries({ queryKey: [spec.key] });
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
  return {
    list,
    items,
    lookups,
    sheet,
    setSheet,
    error,
    valuesOf,
    save,
    toggle,
    open,
    create,
    update,
  };
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

function CrudSheet<Row extends CrudRow>(p: {
  spec: CrudSpec<Row>;
  c: ReturnType<typeof useCrud<Row>>;
  ctx: CrudCtx;
  title: string;
}) {
  const { t } = useTranslation();
  const { spec, c, ctx } = p;
  const row = c.sheet?.row ?? null;
  return (
    <FormSheet
      open
      onOpenChange={(o) => {
        if (!o) c.setSheet(null);
      }}
      title={p.title}
      submitLabel={t('kit.crud.save')}
      fields={spec.fields
        .filter((f) => !row || !f.addOnly)
        .map((f) => ({
          name: f.name,
          label: t(f.labelKey),
          required: f.required,
          kind: f.kind,
          choices: f.choices?.(ctx),
        }))}
      initial={row ? c.valuesOf(row) : {}}
      note={spec.note ? (values) => spec.note!(values, row, ctx) : undefined}
      footnote={spec.footnoteKey ? t(spec.footnoteKey) : undefined}
      offlineAllowed={false}
      pending={c.create.isPending || c.update.isPending}
      error={c.error}
      onSubmit={c.save}
    />
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
  const ctx: CrudCtx = { lookups: c.lookups, t };
  const nameOf = (r: Row) => spec.look?.(r, ctx).title ?? c.valuesOf(r)[spec.fields[0]!.name];
  const add = t(spec.addKey ?? 'kit.crud.add');
  const list = { spec, rows: c.items, onEdit: c.open, busy: c.update.isPending };
  return (
    <PatternFrame title={t(spec.titleKey)}>
      {spec.introKey ? <p className="text-footnote text-neutral-600">{t(spec.introKey)}</p> : null}
      <Button onClick={() => c.open(null)}>{add}</Button>
      {!c.sheet && c.error ? (
        <p role="alert" className="text-body font-medium text-neutral-900">
          {c.error}
        </p>
      ) : null}
      {state !== 'ready' ? (
        <StateNotice state={state} empty={t(spec.emptyKey)} onRetry={() => void c.list.refetch()} />
      ) : spec.look ? (
        <CrudList {...list} ctx={ctx} onToggle={(r) => void c.toggle(r)} />
      ) : (
        <CrudTable {...list} onToggle={(r) => void c.toggle(r)} />
      )}
      {c.sheet ? (
        <CrudSheet
          spec={spec}
          c={c}
          ctx={ctx}
          title={row ? t('kit.crud.editTitle', { name: nameOf(row) }) : add}
        />
      ) : null}
    </PatternFrame>
  );
}
