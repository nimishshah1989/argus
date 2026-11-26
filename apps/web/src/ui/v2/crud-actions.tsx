import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { idempotencyKey } from '../../data/index.js';
import type { CrudBulkAction, CrudRow, CrudSpec } from '../../patterns/crud-spec.js';
import { Button } from './button.js';

/** What a switch sends: never the reason, which a strict reply schema would refuse. */
export function switchBody<Row extends CrudRow>(
  spec: CrudSpec<Row>,
  row: Row,
  values: Record<string, string>,
): Record<string, unknown> {
  if (row.active)
    return {
      active: false,
      ...(spec.switchOff?.sendReason ? { reason: values.reason ?? '' } : {}),
    };
  const field = spec.switchOn?.field;
  return { active: true, ...(field ? { [field]: values[field] ?? '' } : {}) };
}

export interface BulkOutcome {
  done: number;
  failed: number;
  /** What the action counted besides rows (devices signed out). */
  extra: number;
  /** The action's own success line, when it has one. */
  doneKey?: string;
  /** The first refusal, in the server's words. */
  message?: string;
}

/** One action over the ticked rows: a refusal on one row does not stop the others. */
export async function runBulk<Row>(
  action: CrudBulkAction<Row>,
  rows: Row[],
  values: Record<string, string>,
): Promise<BulkOutcome> {
  let done = 0;
  let failed = 0;
  let extra = 0;
  let message: string | undefined;
  for (const row of rows) {
    try {
      const count = await action.run(row, values);
      if (typeof count === 'number') extra += count;
      done += 1;
    } catch (error) {
      failed += 1;
      message ??= error instanceof Error ? error.message : String(error);
    }
  }
  return { done, failed, extra, doneKey: action.doneKey, message };
}

/** The row's own fields first, then each field that has its own route, when it changed. */
export async function saveEdit<Row extends CrudRow>(
  spec: CrudSpec<Row>,
  row: Row,
  values: Record<string, string>,
  put: (body: Record<string, unknown>) => Promise<unknown>,
): Promise<void> {
  const apart = spec.separate ?? {};
  const own = Object.entries(values).filter(([k]) => !(k in apart));
  await put({ ...Object.fromEntries(own), active: row.active });
  for (const [name, send] of Object.entries(apart))
    if (name in values && values[name] !== String(row[name as keyof Row] ?? ''))
      await send(row.id, values[name]!);
}

/** The add/edit sheet: one idempotency key per opening, and the server's own refusal line. */
export function useSave<Row extends CrudRow>(
  spec: CrudSpec<Row>,
  io: {
    create: (v: { body: unknown; idempotencyKey?: string }) => Promise<unknown>;
    update: (v: { id: string; body: unknown }) => Promise<unknown>;
    refresh: () => Promise<unknown>;
  },
  t: TFunction,
) {
  const [sheet, setSheet] = useState<{ row: Row | null; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function save(values: Record<string, string>): Promise<boolean> {
    setError(null);
    const row = sheet?.row;
    try {
      if (!row) await io.create({ body: values, idempotencyKey: sheet?.key });
      else await saveEdit(spec, row, values, (body) => io.update({ id: row.id, body }));
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('kit.crud.error'));
      return false;
    } finally {
      if (row) await io.refresh();
    }
  }
  function open(row: Row | null): void {
    setError(null);
    setSheet({ row, key: idempotencyKey() });
  }
  return { sheet, setSheet, error, setError, save, open };
}

/** The switch that asks first: a reason when switching off, a value (a password) when switching on. */
export function useSwitch<Row extends CrudRow>(
  spec: CrudSpec<Row>,
  update: (v: { id: string; body: unknown }) => Promise<unknown>,
  t: TFunction,
) {
  const [row, setRow] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(values: Record<string, string>): Promise<boolean> {
    if (!row) return false;
    setError(null);
    try {
      await update({ id: row.id, body: switchBody(spec, row, values) });
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('kit.crud.error'));
      return false;
    }
  }
  return { row, setRow, error, submit };
}

/** The ticked rows and the one bulk action running over them. */
export function useBulk<Row extends CrudRow>(
  spec: CrudSpec<Row>,
  items: Row[],
  refresh: () => Promise<unknown>,
  t: TFunction,
) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [action, setAction] = useState<CrudBulkAction<Row> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  function select(id: string, on: boolean): void {
    setSelected((previous) => {
      const next = new Set(previous);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  async function submit(values: Record<string, string>): Promise<boolean> {
    if (!action) return false;
    setError(null);
    setRunning(true);
    const rows = items.filter((item) => selected.has(item.id));
    const result = await runBulk(action, rows, values);
    setRunning(false);
    setOutcome(result);
    await refresh();
    if (result.failed === 0) {
      setSelected(new Set());
      return true;
    }
    setError(
      t('kit.crud.bulkRefused', {
        failed: result.failed,
        message: result.message ?? t('kit.crud.error'),
      }),
    );
    return false;
  }
  return { selected, select, action, setAction, error, setError, running, outcome, submit };
}

/** The bulk bar over a list: one secondary button per approved bulk action. */
export function BulkBar<Row extends CrudRow>({
  spec,
  count,
  onPick,
}: {
  spec: CrudSpec<Row>;
  count: number;
  onPick: (action: CrudBulkAction<Row>) => void;
}) {
  const { t } = useTranslation();
  if (!spec.bulk || count === 0) return null;
  return (
    <section aria-label={t('kit.crud.bulk')} className="v2-crud">
      <p className="v2-crud-hint">{t('kit.crud.selected', { count })}</p>
      <div className="v2-crud-actions">
        {spec.bulk.actions.map((action) => (
          <Button key={action.id} onClick={() => onPick(action)}>
            {t(action.labelKey)}
          </Button>
        ))}
      </div>
    </section>
  );
}
