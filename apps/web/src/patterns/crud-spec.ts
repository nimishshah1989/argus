import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { ResourceSpec } from '../data/index.js';

export type LabelKey = MessageKey | `gallery:${string}`;
export interface CrudRow {
  id: string;
  active: boolean;
}
/** The rows of each lookup resource (`CrudSpec.lookups`), by name; a spec casts what it reads. */
export type Lookups = Record<string, unknown[]>;
/** A reply schema's keys, as the D05 guard reads them without pulling its library into the app. */
export interface ReplySchema {
  shape: Record<string, unknown>;
}
/** What a spec's functions read: the lookup rows by name, and the translator. */
export interface CrudCtx {
  lookups: Lookups;
  t: TFunction;
}
export interface CrudChoice {
  value: string;
  label: string;
}
export interface CrudField {
  /** A reply key, or a write-only field a form sends (a new temporary password). */
  name: string;
  labelKey: LabelKey;
  required?: boolean;
  /** Asked only when adding (a login's first temporary password). */
  requiredOnAdd?: boolean;
  /** `choice` picks one of `choices`; `time` is HH:MM. */
  kind?: 'text' | 'time' | 'choice';
  choices?: (c: CrudCtx) => CrudChoice[];
  /** Asked when adding only: the row keeps it once made (its code, its segment). */
  addOnly?: boolean;
}
/** How a row reads on a phone and in the table's first column. */
export interface CrudLook {
  title: string;
  sub?: string;
  lead?: ReactNode;
  chip?: ReactNode;
}
export interface CrudColumn<Row> {
  labelKey: LabelKey;
  cell: (row: Row, c: CrudCtx) => ReactNode;
  sortKey?: (row: Row, c: CrudCtx) => string | number;
}
export interface CrudToggle {
  /** The switch's own words, with `{{name}}`: "Hide Stabilizer". */
  labelKey: LabelKey;
  /** The switch reads "on" when the row is switched off (a hidden flag). */
  inverted?: boolean;
}
/** Switching a row off asks why first; the reason is required and the switch is only then sent. */
export interface CrudSwitchOff {
  /** What switching this row off does, under the title. */
  hintKey?: LabelKey;
  /** The reason travels with the switch (a person's audit line keeps it). */
  sendReason?: boolean;
}
/** Switching a row on needs a value first (a login's new temporary password). */
export interface CrudSwitchOn {
  field: string;
  labelKey: LabelKey;
  hintKey?: LabelKey;
}
/** One action over the ticked rows, confirmed with a reason and the count it will touch. */
export interface CrudBulkAction<Row> {
  id: string;
  /** The button's words. */
  labelKey: LabelKey;
  /** The confirmation's title, with `{{count}}`. */
  titleKey: LabelKey;
  hintKey?: LabelKey;
  /** A value the action needs first (the new shift). */
  field?: { name: string; labelKey: LabelKey; choices?: (c: CrudCtx) => CrudChoice[] };
  /** Runs once per ticked row; a number is an extra count it reports (devices signed out). */
  run: (row: Row, values: Record<string, string>) => Promise<number | void>;
  /** The success line when the action has its own count to report, with `{{extra}}`. */
  doneKey?: LabelKey;
}
export interface CrudBulk<Row> {
  actions: CrudBulkAction<Row>[];
}
export interface CrudSpec<Row extends CrudRow> extends ResourceSpec {
  titleKey: LabelKey;
  emptyKey: LabelKey;
  /** The Add button and the add sheet; default "Add". */
  addKey?: LabelKey;
  /** The reply the list returns (D05): every key is a form field or declared hidden. */
  schema?: ReplySchema;
  /** Reply keys the screen never shows, each with the reason; the D05 guard permits only these. */
  hidden?: Record<string, string>;
  /** Reply keys the screen shows but never edits, each with the reason (a last sign-in). */
  readOnly?: Record<string, string>;
  /** Form fields, and the table columns when the spec has no `look`. */
  fields: CrudField[];
  /** Resources the choices and the row look draw on (segments, machines), read once and cached. */
  lookups?: Record<string, ResourceSpec>;
  /** With it: a phone list of rows and a sortable desktop table (`columns` after the first). */
  look?: (row: Row, c: CrudCtx) => CrudLook;
  columns?: CrudColumn<Row>[];
  /** Filter chips above the list, with a count each. */
  filter?: {
    allKey: LabelKey;
    options: (c: CrudCtx) => { code: string; name: string }[];
    of: (row: Row, c: CrudCtx) => string | null;
  };
  search?: { labelKey: LabelKey; text: (row: Row, c: CrudCtx) => string };
  /** Phone rows grouped under a heading (groups under their segment). */
  section?: (row: Row, c: CrudCtx) => { key: string; title: string; lead?: ReactNode };
  /** `false`: no switch on the list (a machine's status is a field). A switch config: a labelled switch. Default: Switch off/on button. */
  toggle?: false | CrudToggle;
  /** With it, switching off asks a reason first. */
  switchOff?: CrudSwitchOff;
  /** With it, switching on asks a value first (a new temporary password). */
  switchOn?: CrudSwitchOn;
  /** With it, rows carry a tick box and a bulk bar appears while any is ticked. */
  bulk?: CrudBulk<Row>;
  /** A line under the form, from what the fields hold now. */
  note?: (values: Record<string, string>, row: Row | null, c: CrudCtx) => string | null;
  /** Fields saved by their own route after the row (a machine's criticality refreshes its open tickets). */
  separate?: Record<string, (id: string, value: string) => Promise<unknown>>;
  introKey?: LabelKey;
  footnoteKey?: LabelKey;
}
