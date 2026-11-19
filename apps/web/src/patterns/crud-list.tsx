/* eslint-disable i18next/no-literal-string -- prop values and ARIA roles only; every visible string goes through t() */
import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button.js';
import { FilterChip } from '../ui/filter-chip.js';
import { Check } from '../ui/icon.js';
import { Input } from '../ui/input.js';
import { Stack } from '../ui/layout.js';
import { TONE_FILL } from '../ui/meaning.js';
import { QueueTable, type QueueColumn } from './queue-table.js';
import type { CrudCtx, CrudRow, CrudSpec } from './crud-spec.js';
import { useWide } from './wide.js';

export interface ListProps<Row extends CrudRow> {
  spec: CrudSpec<Row>;
  rows: Row[];
  ctx: CrudCtx;
  onEdit: (row: Row) => void;
  onToggle: (row: Row) => void;
  busy: boolean;
  /** Ticked rows, when the spec allows bulk actions. */
  selected?: ReadonlySet<string>;
  selectable?: boolean;
  onSelect?: (id: string, on: boolean) => void;
}

/** The tick box a bulk action needs; the label around it keeps the 44 px tap target. */
function SelectBox(p: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex min-h-target-min min-w-target-min flex-none items-center justify-center">
      <input
        type="checkbox"
        aria-label={p.label}
        checked={p.checked}
        onChange={(event) => p.onChange(event.target.checked)}
        className="size-5 accent-accent-strong"
      />
    </label>
  );
}

/** The row's on/off control: a Switch off/on button, or the spec's own labelled switch. */
function Toggle<Row extends CrudRow>(p: ListProps<Row> & { row: Row; name: string }) {
  const { t } = useTranslation();
  const { toggle } = p.spec;
  if (toggle === false) return null;
  if (!toggle) {
    return (
      <Button
        variant="secondary"
        disabled={p.busy}
        aria-label={t(p.row.active ? 'kit.crud.switchOffRow' : 'kit.crud.switchOnRow', {
          name: p.name,
        })}
        onClick={() => p.onToggle(p.row)}
      >
        {p.row.active ? t('kit.crud.switchOff') : t('kit.crud.switchOn')}
      </Button>
    );
  }
  const on = toggle.inverted ? !p.row.active : p.row.active;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={t(toggle.labelKey, { name: p.name })}
      disabled={p.busy}
      onClick={() => p.onToggle(p.row)}
      className="flex min-h-target-min w-13 flex-none items-center"
    >
      {/* The pill stays 32 px tall; the button around it keeps the kit's 44 px tap target. */}
      <span
        className={`relative block h-8 w-13 rounded-full transition-colors duration-(--motion-fast) ${on ? 'bg-accent-strong' : 'bg-neutral-500'}`}
      >
        <span
          className={`absolute top-0.5 size-7 rounded-full bg-surface shadow-card transition-[left] duration-(--motion-fast) ${on ? 'left-5.5' : 'left-0.5'}`}
        />
      </span>
    </button>
  );
}

function EditRow<Row extends CrudRow>(p: ListProps<Row> & { row: Row }) {
  const { t } = useTranslation();
  const look = p.spec.look!(p.row, p.ctx);
  return (
    <div className="border-t border-neutral-200 first:border-t-0">
      <div className="flex items-center gap-3">
        {p.selectable ? (
          <SelectBox
            label={t('kit.crud.selectRow', { name: look.title })}
            checked={Boolean(p.selected?.has(p.row.id))}
            onChange={(on) => p.onSelect?.(p.row.id, on)}
          />
        ) : null}
        <button
          type="button"
          aria-label={t('kit.crud.editRow', { name: look.title })}
          onClick={() => p.onEdit(p.row)}
          className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 text-left"
        >
          {look.lead}
          <span className="min-w-0">
            <span className="block truncate text-title3 font-bold">{look.title}</span>
            {look.sub ? (
              <span className="block text-footnote text-neutral-600">{look.sub}</span>
            ) : null}
            {look.tag}
          </span>
        </button>
        {look.chip}
        <Toggle {...p} name={look.title} />
      </div>
      {look.extra}
    </div>
  );
}

function Sections<Row extends CrudRow>(p: ListProps<Row>) {
  const { section } = p.spec;
  const keys: string[] = [];
  const byKey = new Map<string, { head: ReturnType<NonNullable<typeof section>>; rows: Row[] }>();
  for (const row of p.rows) {
    const head = section ? section(row, p.ctx) : { key: '', title: '' };
    if (!byKey.has(head.key)) {
      byKey.set(head.key, { head, rows: [] });
      keys.push(head.key);
    }
    byKey.get(head.key)!.rows.push(row);
  }
  return (
    <>
      {keys.map((key) => {
        const { head, rows } = byKey.get(key)!;
        return (
          <section key={key} className="flex flex-col gap-2">
            {section ? (
              <h3 className="flex items-center gap-2 px-1 text-footnote font-semibold text-neutral-600">
                {head.lead}
                {head.title}
              </h3>
            ) : null}
            <div className="rounded-2xl bg-surface px-4 shadow-card">
              {rows.map((row) => (
                <EditRow key={row.id} {...p} row={row} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function Filters<Row extends CrudRow>(p: {
  spec: CrudSpec<Row>;
  rows: Row[];
  ctx: CrudCtx;
  chosen: string | null;
  onChoose: (code: string | null) => void;
}) {
  const { t } = useTranslation();
  const { filter } = p.spec;
  if (!filter) return null;
  const count = (code: string) => p.rows.filter((r) => filter.of(r, p.ctx) === code).length;
  const options = filter
    .options(p.ctx)
    .map((o) => ({ ...o, n: count(o.code) }))
    .filter((o) => o.n > 0)
    .sort((a, b) => b.n - a.n);
  return (
    <div className="flex flex-wrap gap-2">
      <FilterChip
        filter={{ all: t(filter.allKey) }}
        count={p.rows.length}
        pressed={p.chosen === null}
        onClick={() => p.onChoose(null)}
      />
      {options.map((o) => (
        <FilterChip
          key={o.code}
          filter={{ segment: { code: o.code, name: o.name } }}
          count={o.n}
          pressed={p.chosen === o.code}
          onClick={() => p.onChoose(p.chosen === o.code ? null : o.code)}
        />
      ))}
    </div>
  );
}

/** The spec's one flag chip ("2 machines not counted"): shown while any row carries it, tap to list only those. */
function FlagChip<Row extends CrudRow>(p: {
  spec: CrudSpec<Row>;
  rows: Row[];
  pressed: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { flag } = p.spec;
  const count = flag ? p.rows.filter(flag.test).length : 0;
  if (!flag || (count === 0 && !p.pressed)) return null;
  const Icon = flag.icon;
  return (
    <button
      type="button"
      aria-pressed={p.pressed}
      onClick={p.onPress}
      className={`inline-flex min-h-target-min items-center gap-2 self-start whitespace-nowrap rounded-full px-3 text-footnote font-semibold ${p.pressed ? 'bg-accent-tint text-accent-text ring-2 ring-accent-strong' : `${TONE_FILL.muted}`}`}
    >
      <Icon aria-hidden size={18} />
      {t(flag.labelKey, { count })}
      {p.pressed ? <Check aria-hidden size={16} strokeWidth={3} /> : null}
    </button>
  );
}

function tableColumns<Row extends CrudRow>(p: ListProps<Row>, t: TFunction) {
  const first: QueueColumn<Row> = {
    label: t(p.spec.titleKey),
    sortKey: (row) => p.spec.look!(row, p.ctx).title,
    cell: (row) => {
      const look = p.spec.look!(row, p.ctx);
      return (
        <button
          type="button"
          aria-label={t('kit.crud.editRow', {
            name: look.title,
          })}
          onClick={() => p.onEdit(row)}
          className="flex min-h-target-min items-center gap-3 text-left"
        >
          {look.lead}
          <span>
            <span className="block font-semibold">{look.title}</span>
            {look.sub ? <span className="block text-neutral-600">{look.sub}</span> : null}
            {look.tag}
          </span>
        </button>
      );
    },
  };
  const rest: QueueColumn<Row>[] = (p.spec.columns ?? []).map((c) => ({
    label: t(c.labelKey),
    sortKey: c.sortKey ? (row) => c.sortKey!(row, p.ctx) : undefined,
    cell: (row) => c.cell(row, p.ctx),
  }));
  const switchColumn: QueueColumn<Row>[] =
    p.spec.toggle === false
      ? []
      : [
          {
            label: t('kit.crud.status'),
            cell: (row) => <Toggle {...p} row={row} name={p.spec.look!(row, p.ctx).title} />,
          },
        ];
  const selectColumn: QueueColumn<Row>[] = p.selectable
    ? [
        {
          label: t('kit.crud.select'),
          cell: (row) => (
            <SelectBox
              label={t('kit.crud.selectRow', { name: p.spec.look!(row, p.ctx).title })}
              checked={Boolean(p.selected?.has(row.id))}
              onChange={(on) => p.onSelect?.(row.id, on)}
            />
          ),
        },
      ]
    : [];
  return [first, ...rest, ...switchColumn, ...selectColumn];
}

/** The settings list: phone rows under search and filter chips, a sortable table from 1024 px. */
export function CrudList<Row extends CrudRow>(p: ListProps<Row>) {
  const { t } = useTranslation();
  const wide = useWide();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [flagged, setFlagged] = useState(false);
  const { filter, flag, search } = p.spec;
  const shown = p.rows.filter(
    (row) =>
      (chosen === null || filter?.of(row, p.ctx) === chosen) &&
      (!flagged || !flag || flag.test(row)) &&
      (!search || search.text(row, p.ctx).toLowerCase().includes(query.trim().toLowerCase())),
  );
  const view = { ...p, rows: shown };
  return (
    <Stack gap={3}>
      {search ? (
        <Input
          type="search"
          aria-label={t(search.labelKey)}
          placeholder={t(search.labelKey)}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      ) : null}
      <Filters {...p} chosen={chosen} onChoose={setChosen} />
      <FlagChip
        spec={p.spec}
        rows={p.rows}
        pressed={flagged}
        onPress={() => setFlagged(!flagged)}
      />
      {wide ? (
        <QueueTable
          title={t(p.spec.titleKey)}
          rows={shown}
          columns={tableColumns(view, t)}
          rowKey={(row) => row.id}
        />
      ) : (
        <Sections {...view} />
      )}
    </Stack>
  );
}
