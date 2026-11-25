/* eslint-disable i18next/no-literal-string -- keys, prop values and typed unions only; every visible word goes through t() */
import { useMemo, type ReactNode } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getConfig } from '../../api.js';
import { ApiError, defineResource, useOnline } from '../../data/index.js';
import { BulkBar, useBulk, useSave, useSwitch } from '../../patterns/crud-actions.js';
import type {
  CrudBulkAction,
  CrudCtx,
  CrudLook,
  CrudRow,
  CrudSpec,
  Lookups,
} from '../../patterns/crud-spec.js';
import type { FormField } from '../../patterns/form-sheet.js';
import { sheetFields, switchFields } from './crud-model.js';
import { DataTable, type Column, type FilterChip } from './data-table.js';
import { FormSheet } from './form-sheet.js';
import { EmptyState, ErrorState, OfflineState, Skeleton } from './screen-states.js';

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
  const refresh = () => client.invalidateQueries({ queryKey: [spec.key] });
  const saving = useSave(
    spec,
    { create: (v) => create.mutateAsync(v), update: (v) => update.mutateAsync(v), refresh },
    t,
  );
  const sw = useSwitch(spec, (v) => update.mutateAsync(v), t);
  const bulk = useBulk(spec, items, refresh, t);
  const valuesOf = (row: Row): Record<string, string> =>
    Object.fromEntries(spec.fields.map((f) => [f.name, String(row[f.name as keyof Row] ?? '')]));

  /** A switch with a reason or a value first opens its sheet; the rest flip in place. */
  async function toggle(row: Row): Promise<void> {
    saving.setError(null);
    if (switchFields(spec, row, t)) {
      sw.setRow(row);
      return;
    }
    try {
      await update.mutateAsync({ id: row.id, body: { ...valuesOf(row), active: !row.active } });
    } catch (failure) {
      // The server's own words for a refusal, or the generic line.
      saving.setError(failure instanceof ApiError ? failure.message : t('kit.crud.error'));
    }
  }
  return { list, items, lookups, saving, create, update, sw, bulk, valuesOf, toggle };
}
type Crud<Row extends CrudRow> = ReturnType<typeof useCrud<Row>>;
type PageProps<Row extends CrudRow> = { spec: CrudSpec<Row>; c: Crud<Row>; ctx: CrudCtx };

const textOf = <Row extends CrudRow>(row: Row, name: string) =>
  String(row[name as keyof Row] ?? '');
/** A row's name: its look's title, else its first field. */
const nameIn = <Row extends CrudRow>({ spec, ctx }: PageProps<Row>, row: Row) =>
  spec.look?.(row, ctx).title ?? textOf(row, spec.fields[0]!.name);

function FirstCell(p: { look?: CrudLook; text: string }) {
  const { look } = p;
  if (!look) return <>{p.text}</>;
  return (
    <>
      {look.lead}
      <strong>{look.title}</strong>
      {look.sub ? <span className="v2-crud-sub">{look.sub}</span> : null}
      {look.chip}
      {look.tag}
    </>
  );
}

function RowActions<Row extends CrudRow>(p: PageProps<Row> & { row: Row }) {
  const { spec, c, row } = p;
  const { t } = p.ctx;
  const name = nameIn(p, row);
  const label = spec.toggle
    ? t(spec.toggle.labelKey, { name })
    : t(row.active ? 'kit.crud.switchOffRow' : 'kit.crud.switchOnRow', { name });
  return (
    <span className="v2-crud-row-actions">
      <button
        type="button"
        className="v2-btn v2-btn-ghost"
        aria-label={t('kit.crud.editRow', { name })}
        onClick={() => c.saving.open(row)}
      >
        {t('kit.crud.edit')}
      </button>
      {spec.toggle === false ? null : (
        <button
          type="button"
          className="v2-btn v2-btn-ghost"
          disabled={c.update.isPending}
          aria-label={label}
          onClick={() => void c.toggle(row)}
        >
          {t(row.active ? 'kit.crud.switchOff' : 'kit.crud.switchOn')}
        </button>
      )}
    </span>
  );
}

/** The list's columns: ticks (bulk), the name, the spec's columns or fields, the status, the row's buttons. */
function columnsOf<Row extends CrudRow>(p: PageProps<Row>): Column<Row>[] {
  const { spec, c, ctx } = p;
  const { t } = ctx;
  const first = spec.fields[0]!;
  const cols: Column<Row>[] = [];
  if (spec.bulk)
    cols.push({
      key: 'select',
      label: t('kit.crud.select'),
      cell: (r) => (
        <input
          type="checkbox"
          aria-label={t('kit.crud.selectRow', { name: nameIn(p, r) })}
          checked={c.bulk.selected.has(r.id)}
          onChange={(e) => c.bulk.select(r.id, e.target.checked)}
        />
      ),
    });
  cols.push({
    key: first.name,
    label: t(first.labelKey),
    sortBy: (r) => nameIn(p, r),
    cell: (r) => <FirstCell look={spec.look?.(r, ctx)} text={textOf(r, first.name)} />,
  });
  const rest: Column<Row>[] = spec.look
    ? (spec.columns ?? []).map((col, i) => ({
        key: `col${i}`,
        label: t(col.labelKey),
        cell: (r) => col.cell(r, ctx),
        sortBy: col.sortKey && ((r) => col.sortKey!(r, ctx)),
      }))
    : spec.fields.slice(1).map((f) => ({
        key: f.name,
        label: t(f.labelKey),
        cell: (r) => textOf(r, f.name),
        sortBy: (r) => textOf(r, f.name),
      }));
  return [
    ...cols,
    ...rest,
    {
      key: 'status',
      label: t('kit.crud.status'),
      cell: (r) => t(r.active ? 'kit.crud.on' : 'kit.crud.off'),
    },
    {
      key: 'actions',
      label: t('kit.crud.actions'),
      cell: (r) => <RowActions {...p} row={r} />,
    },
  ];
}

/** The chips over the list: all, one per filter option, then the flag; each carries its count. */
function chipsOf<Row extends CrudRow>(spec: CrudSpec<Row>, rows: Row[], ctx: CrudCtx) {
  if (!spec.filter && !spec.flag) return [];
  const count = (test: (r: Row) => boolean) => rows.filter(test).length;
  const chips: FilterChip<Row>[] = spec.filter
    ? [{ key: 'all', label: `${ctx.t(spec.filter.allKey)} ${rows.length}` }]
    : [{ key: 'all', label: String(rows.length) }];
  for (const o of spec.filter?.options(ctx) ?? []) {
    const test = (r: Row) => spec.filter!.of(r, ctx) === o.code;
    chips.push({ key: o.code, label: `${o.name} ${count(test)}`, test });
  }
  if (spec.flag)
    chips.push({
      key: 'flag',
      label: ctx.t(spec.flag.labelKey, { count: count(spec.flag.test) }),
      test: spec.flag.test,
    });
  return chips;
}

function CrudList<Row extends CrudRow>(p: PageProps<Row>) {
  const { spec, c, ctx } = p;
  const { t } = ctx;
  const online = useOnline();
  const retry = () => void c.list.refetch();
  if (c.list.error && c.list.data === undefined)
    return online ? <ErrorState onRetry={retry} /> : <OfflineState onRetry={retry} />;
  if (c.list.data === undefined) return <Skeleton />;
  if (c.items.length === 0) return <EmptyState text={t(spec.emptyKey)} />;
  return (
    <DataTable
      rows={c.items}
      rowKey={(r) => r.id}
      columns={columnsOf(p)}
      filters={chipsOf(spec, c.items, ctx)}
      text={(r) => spec.search?.text(r, ctx) ?? textOf(r, spec.fields[0]!.name)}
      words={{
        title: t(spec.titleKey),
        search: spec.search ? t(spec.search.labelKey) : '',
        showing: t('v2m.showing'),
        noResults: t('v2m.noResults'),
        open: t('kit.crud.edit'),
      }}
    />
  );
}

function SaveSheet<Row extends CrudRow>(
  p: PageProps<Row> & { add: string; row: Row | null; sheetKey: string },
) {
  const { spec, c, ctx, row } = p;
  const { t } = ctx;
  return (
    <FormSheet
      key={p.sheetKey}
      open
      onOpenChange={(o) => o || c.saving.setSheet(null)}
      title={row ? t('kit.crud.editTitle', { name: nameIn(p, row) }) : p.add}
      submitLabel={t('kit.crud.save')}
      fields={sheetFields(spec, row, ctx)}
      initial={row ? c.valuesOf(row) : {}}
      note={spec.note ? (values) => spec.note!(values, row, ctx) : undefined}
      footnote={spec.footnoteKey ? t(spec.footnoteKey) : undefined}
      offlineAllowed={false}
      pending={c.create.isPending || c.update.isPending}
      error={c.saving.error}
      onSubmit={c.saving.save}
    />
  );
}

function SwitchSheet<Row extends CrudRow>(p: PageProps<Row> & { row: Row; fields: FormField[] }) {
  const { spec, c, row } = p;
  const { t } = p.ctx;
  const config = row.active ? spec.switchOff : spec.switchOn;
  const name = nameIn(p, row);
  return (
    <FormSheet
      key={row.id}
      open
      onOpenChange={(o) => o || c.sw.setRow(null)}
      title={t(row.active ? 'kit.crud.switchOffRow' : 'kit.crud.switchOnRow', { name })}
      submitLabel={t(row.active ? 'kit.crud.switchOff' : 'kit.crud.switchOn')}
      fields={p.fields}
      description={config?.hintKey ? t(config.hintKey) : t('kit.crud.reasonHint')}
      offlineAllowed={false}
      pending={c.update.isPending}
      error={c.sw.error}
      onSubmit={c.sw.submit}
    />
  );
}

function BulkSheet<Row extends CrudRow>(p: PageProps<Row> & { action: CrudBulkAction<Row> }) {
  const { c, ctx, action } = p;
  const { t } = ctx;
  const extra = action.field
    ? [
        {
          name: action.field.name,
          label: t(action.field.labelKey),
          kind: 'choice' as const,
          choices: action.field.choices?.(ctx),
        },
      ]
    : [];
  return (
    <FormSheet
      key={action.id}
      open
      onOpenChange={(o) => o || c.bulk.setAction(null)}
      title={t(action.titleKey, { count: c.bulk.selected.size })}
      submitLabel={t(action.labelKey)}
      fields={[
        { name: 'reason', label: t('kit.crud.reason'), required: true, multiline: true },
        ...extra,
      ]}
      description={action.hintKey ? t(action.hintKey) : undefined}
      offlineAllowed={false}
      pending={c.bulk.running}
      error={c.bulk.error}
      onSubmit={c.bulk.submit}
    />
  );
}

/** The one sheet that is open: add/edit, then switch, then bulk; the drawer holds one thing at a time. */
function Sheets<Row extends CrudRow>(p: PageProps<Row> & { add: string }) {
  const { spec, c } = p;
  const sheet = c.saving.sheet;
  if (sheet && (spec.addable !== false || sheet.row))
    return <SaveSheet {...p} row={sheet.row} sheetKey={sheet.key} />;
  const fields = c.sw.row && switchFields(spec, c.sw.row, p.ctx.t);
  if (c.sw.row && fields) return <SwitchSheet {...p} row={c.sw.row} fields={fields} />;
  return c.bulk.action ? <BulkSheet {...p} action={c.bulk.action} /> : null;
}

/** A settings page generated from one `CrudSpec`, the kit's look: list, add, edit, switch off and on; never delete. */
export function CrudPage<Row extends CrudRow>({ spec }: { spec: CrudSpec<Row> }): ReactNode {
  const { t } = useTranslation();
  const c = useCrud(spec);
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const ctx: CrudCtx = { lookups: c.lookups, t, timeZone: config.data?.timeZone };
  const add = t(spec.addKey ?? 'kit.crud.add');
  const outcome = c.bulk.outcome;
  return (
    <div className="v2-crud">
      {spec.introKey ? <p className="v2-crud-hint">{t(spec.introKey)}</p> : null}
      {spec.addable !== false ? (
        <button type="button" className="v2-btn v2-btn-primary" onClick={() => c.saving.open(null)}>
          {add}
        </button>
      ) : null}
      {!c.saving.sheet && c.saving.error ? (
        <p role="alert" className="v2-crud-hint">
          {c.saving.error}
        </p>
      ) : null}
      <CrudList spec={spec} c={c} ctx={ctx} />
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
        <p role="status" className="v2-crud-hint">
          {t(outcome.doneKey ?? 'kit.crud.bulkDone', {
            done: outcome.done,
            count: outcome.done + outcome.failed,
            extra: outcome.extra,
          })}
        </p>
      ) : null}
      <Sheets spec={spec} c={c} ctx={ctx} add={add} />
    </div>
  );
}
