import type { TFunction } from 'i18next';
import type { CrudCtx, CrudRow, CrudSpec } from '../../patterns/crud-spec.js';

export interface FormField {
  name: string;
  label: string;
  required?: boolean;
  /** A taller text box for a sentence or two. */
  multiline?: boolean;
  /** Longest text the server accepts; the box stops there so a queued command is never refused. */
  maxLength?: number;
  /** `choice` picks one of `choices` (a bar for up to four, a menu for more); `time` is HH:MM; `date` is a day. */
  kind?: 'text' | 'time' | 'date' | 'choice';
  choices?: { value: string; label: string }[];
}
export interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  fields: FormField[];
  offlineAllowed: boolean;
  pending: boolean;
  error: string | null;
  /** True closes the sheet and clears the fields. */
  onSubmit: (values: Record<string, string>) => Promise<boolean>;
  /** First values of the fields; default {}. */
  initial?: Record<string, string>;
  /** A line under the title. */
  description?: string;
  /** "Acting as <name>", above the button. */
  actingAs?: string;
  /** With it, a "Go back" button sits left of the submit button. */
  backLabel?: string;
  /** A line shown under the fields, from what they hold now (a cell change says what it will move). */
  note?: (values: Record<string, string>) => string | null;
  /** True holds the submit button: a combination the server would refuse, explained by `note`. */
  blocked?: (values: Record<string, string>) => boolean;
  /** A small line under the button. */
  footnote?: string;
}

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
  return spec.fields
    .filter((f) => !row || !f.addOnly)
    .map((f) => ({
      name: f.name,
      label: ctx.t(f.labelKey),
      required: f.required || (!row && f.requiredOnAdd),
      kind: f.kind,
      choices: f.choices?.(ctx),
    }));
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
  if (row.active)
    return spec.switchOff
      ? [{ name: 'reason', label: t('kit.crud.reason'), required: true, multiline: true }]
      : null;
  return spec.switchOn
    ? [{ name: spec.switchOn.field, label: t(spec.switchOn.labelKey), required: true }]
    : null;
}

/** True when a required field is empty after trimming: the only check the client makes (the server validates the rest). */
export function missingRequired(fields: FormField[], values: Record<string, string>): boolean {
  return fields.some((f) => f.required && (values[f.name] ?? '').trim() === '');
}

/** Why the submit waits, or null when it may be sent; offline wins over everything (writes are never queued here). */
export function submitHeld(state: HoldState): 'offline' | 'pending' | 'missing' | 'blocked' | null {
  if (!state.online) return 'offline';
  if (state.pending) return 'pending';
  if (state.missing) return 'missing';
  return state.blocked ? 'blocked' : null;
}
