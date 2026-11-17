import { useMemo } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getConfig } from '../api.js';
import { ApiError, defineResource, useOnline } from '../data/index.js';
import { Button } from '../ui/button.js';
import { Inline } from '../ui/layout.js';
import { BulkBar, useBulk, useSave, useSwitch } from './crud-actions.js';
import { CrudList } from './crud-list.js';
import type { CrudCtx, CrudRow, CrudSpec, Lookups } from './crud-spec.js';
import { FormSheet } from './form-sheet.js';
import { PatternFrame, StateNotice } from './frame.js';
import { viewState, type ViewState } from './view-state.js';

export type { CrudRow, CrudField, CrudSpec, LabelKey } from './crud-spec.js';

/** The server's own words for a refusal (the E.164 message), or the generic line. */
function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

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
  const saving = useSave(
    spec,
    {
      create: (v) => create.mutateAsync(v),
      update: (v) => update.mutateAsync(v),
      refresh: () => client.invalidateQueries({ queryKey: [spec.key] }),
    },
    t,
  );
  const sw = useSwitch(spec, (v) => update.mutateAsync(v), t);
  const bulk = useBulk(spec, items, () => client.invalidateQueries({ queryKey: [spec.key] }), t);
  const valuesOf = (row: Row): Record<string, string> =>
    Object.fromEntries(spec.fields.map((f) => [f.name, String(row[f.name as keyof Row] ?? '')]));

  /** A switch with a reason or a value first opens its sheet; the rest flip in place. */
  async function toggle(row: Row): Promise<void> {
    saving.setError(null);
    if (row.active ? spec.switchOff : spec.switchOn) {
      sw.setRow(row);
      return;
    }
    try {
      await update.mutateAsync({ id: row.id, body: { ...valuesOf(row), active: !row.active } });
    } catch (failure) {
      saving.setError(messageOf(failure, t('kit.crud.error')));
    }
  }
  return {
    list,
    items,
    lookups,
    sheet: saving.sheet,
    setSheet: saving.setSheet,
    error: saving.error,
    valuesOf,
    save: saving.save,
    toggle,
    open: saving.open,
    create,
    update,
    switch: sw,
    bulk,
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
  const name = String(row[first!.name as keyof Row] ?? '');
  return (
    <tr className="border-t border-neutral-200 lg:h-13">
      <th scope="row" className="p-2 font-medium lg:px-3">
        {name}
      </th>
      {others.map((f) => (
        <td key={f.name} className="p-2 lg:px-3">
          {String(row[f.name as keyof Row] ?? '')}
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
          required: f.required || (!row && f.requiredOnAdd),
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

function SwitchSheet<Row extends CrudRow>(p: {
  spec: CrudSpec<Row>;
  c: ReturnType<typeof useCrud<Row>>;
  name: string;
}) {
  const { t } = useTranslation();
  const { spec, c } = p;
  const row = c.switch.row;
  if (!row) return null;
  const on = !row.active;
  const config = on ? spec.switchOn : spec.switchOff;
  const fields = on
    ? [
        {
          name: spec.switchOn!.field,
          label: t(spec.switchOn!.labelKey),
          required: true,
        },
      ]
    : [{ name: 'reason', label: t('kit.crud.reason'), required: true, multiline: true }];
  return (
    <FormSheet
      open
      onOpenChange={(o) => {
        if (!o) c.switch.setRow(null);
      }}
      title={t(on ? 'kit.crud.switchOnRow' : 'kit.crud.switchOffRow', { name: p.name })}
      submitLabel={t(on ? 'kit.crud.switchOn' : 'kit.crud.switchOff')}
      fields={fields}
      description={config?.hintKey ? t(config.hintKey) : t('kit.crud.reasonHint')}
      offlineAllowed={false}
      pending={c.update.isPending}
      error={c.switch.error}
      onSubmit={c.switch.submit}
    />
  );
}

function BulkSheet<Row extends CrudRow>(p: { c: ReturnType<typeof useCrud<Row>>; ctx: CrudCtx }) {
  const { t } = useTranslation();
  const { c, ctx } = p;
  const action = c.bulk.action;
  if (!action) return null;
  const fields = [
    { name: 'reason', label: t('kit.crud.reason'), required: true, multiline: true },
    ...(action.field
      ? [
          {
            name: action.field.name,
            label: t(action.field.labelKey),
            kind: 'choice' as const,
            choices: action.field.choices?.(ctx),
          },
        ]
      : []),
  ];
  return (
    <FormSheet
      open
      onOpenChange={(o) => {
        if (!o) c.bulk.setAction(null);
      }}
      title={t(action.titleKey, { count: c.bulk.selected.size })}
      submitLabel={t(action.labelKey)}
      fields={fields}
      description={action.hintKey ? t(action.hintKey) : undefined}
      offlineAllowed={false}
      pending={c.bulk.running}
      error={c.bulk.error}
      onSubmit={c.bulk.submit}
    />
  );
}

function CrudBody<Row extends CrudRow>(p: {
  spec: CrudSpec<Row>;
  c: ReturnType<typeof useCrud<Row>>;
  ctx: CrudCtx;
  state: ViewState;
}) {
  const { t } = useTranslation();
  const { spec, c, ctx, state } = p;
  if (state !== 'ready')
    return (
      <StateNotice state={state} empty={t(spec.emptyKey)} onRetry={() => void c.list.refetch()} />
    );
  const list = {
    spec,
    rows: c.items,
    onEdit: c.open,
    busy: c.update.isPending,
    selected: c.bulk.selected,
    selectable: Boolean(spec.bulk),
    onSelect: c.bulk.select,
    onToggle: (row: Row) => void c.toggle(row),
  };
  if (spec.look) return <CrudList {...list} ctx={ctx} />;
  return (
    <CrudTable
      spec={spec}
      rows={c.items}
      onEdit={c.open}
      onToggle={list.onToggle}
      busy={c.update.isPending}
    />
  );
}

function CrudExtras<Row extends CrudRow>(p: {
  spec: CrudSpec<Row>;
  c: ReturnType<typeof useCrud<Row>>;
}) {
  const { t } = useTranslation();
  const { spec, c } = p;
  const outcome = c.bulk.outcome;
  return (
    <>
      {spec.bulk ? (
        <BulkBar
          spec={spec}
          count={c.bulk.selected.size}
          onPick={(action) => {
            c.bulk.setError(null);
            c.bulk.setAction(action);
          }}
        />
      ) : null}
      {outcome ? (
        <p role="status" className="text-footnote text-neutral-600">
          {t(outcome.doneKey ?? 'kit.crud.bulkDone', {
            done: outcome.done,
            count: outcome.done + outcome.failed,
            extra: outcome.extra,
          })}
        </p>
      ) : null}
    </>
  );
}

/** A settings page generated from one `CrudSpec`: list, add, edit, switch off and on; never delete. */
export function CrudPage<Row extends CrudRow>({ spec }: { spec: CrudSpec<Row> }) {
  const { t } = useTranslation();
  const c = useCrud(spec);
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const state = viewState({
    online: useOnline(),
    hasData: c.list.data !== undefined,
    isEmpty: c.items.length === 0,
    error: c.list.error,
  });
  const ctx: CrudCtx = { lookups: c.lookups, t, timeZone: config.data?.timeZone };
  const nameOf = (r: Row) => spec.look?.(r, ctx).title ?? c.valuesOf(r)[spec.fields[0]!.name] ?? '';
  const add = t(spec.addKey ?? 'kit.crud.add');
  return (
    <PatternFrame title={t(spec.titleKey)}>
      {spec.introKey ? <p className="text-footnote text-neutral-600">{t(spec.introKey)}</p> : null}
      {spec.addable !== false ? <Button onClick={() => c.open(null)}>{add}</Button> : null}
      {!c.sheet && c.error ? (
        <p role="alert" className="text-body font-medium text-neutral-900">
          {c.error}
        </p>
      ) : null}
      <CrudBody spec={spec} c={c} ctx={ctx} state={state} />
      <CrudExtras spec={spec} c={c} />
      {c.sheet && (spec.addable !== false || c.sheet.row) ? (
        <CrudSheet
          spec={spec}
          c={c}
          ctx={ctx}
          title={c.sheet.row ? t('kit.crud.editTitle', { name: nameOf(c.sheet.row) }) : add}
        />
      ) : null}
      <SwitchSheet spec={spec} c={c} name={c.switch.row ? nameOf(c.switch.row) : ''} />
      <BulkSheet c={c} ctx={ctx} />
    </PatternFrame>
  );
}
