import type { TFunction } from 'i18next';
import type { CrudCtx, CrudRow, CrudSpec } from '../../patterns/crud-spec.js';
import type { FormField } from '../../patterns/form-sheet.js';

/** What holds a sheet's submit: a write in flight, no connection, a required field left empty, or the caller's own refusal. */
export type HoldState = { pending: boolean; online: boolean; missing: boolean; blocked?: boolean };

/**
 * The add sheet (`row` null) or the edit sheet's fields, in the spec's order, labels translated with `ctx.t`. Adding asks
 * every field and `requiredOnAdd` counts as required; editing leaves `addOnly` fields out. `choices` are read with `ctx`.
 */
export function sheetFields<Row extends CrudRow>(
  spec: CrudSpec<Row>,
  row: Row | null,
  ctx: CrudCtx,
): FormField[] {
  void [spec, row, ctx];
  throw new Error('not implemented');
}

/**
 * The fields switching `row` asks first, or null when the switch is sent at once. An active row being switched off asks
 * `reason` (label `kit.crud.reason`, required, multiline) when the spec has `switchOff`; an inactive row being switched
 * on asks the spec's `switchOn.field` (required) when it has `switchOn`.
 */
export function switchFields<Row extends CrudRow>(
  spec: CrudSpec<Row>,
  row: Row,
  t: TFunction,
): FormField[] | null {
  void [spec, row, t];
  throw new Error('not implemented');
}

/** True when a required field is empty after trimming: the only check the client makes (the server validates the rest). */
export function missingRequired(fields: FormField[], values: Record<string, string>): boolean {
  void [fields, values];
  throw new Error('not implemented');
}

/** Why the submit waits, or null when it may be sent; offline wins over everything (writes are never queued here). */
export function submitHeld(state: HoldState): 'offline' | 'pending' | 'missing' | 'blocked' | null {
  void state;
  throw new Error('not implemented');
}
