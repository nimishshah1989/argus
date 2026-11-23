import type { TFunction } from 'i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { DataChecklistModel } from './model.js';

/**
 * The Data Checklist from the engine's `data-checklist` figure (DC-1, ADR 0017). The engine sends
 * `{ counts, items: [{ group, key, plain }] }`; `plain` is `"<DD-MM-YYYY> · <machine> — <what>"` for a breakdown or
 * Why-Why item, `"<machine> — <what>"` for a machine item and `"<DD-MM-YYYY> to <DD-MM-YYYY> — <what>"` for a log gap.
 * Everything else the model prints is decided in ADR 0017 and written in the tables below.
 */

/** One open item, as the engine sends it. */
export type ChecklistItem = { group: string; key: string; plain: string };

/** The engine's sixteen groups in its own order (`packages/domain/src/analytics/data-checklist.ts` GROUPS). */
export const GROUPS = [
  'bd_date',
  'bd_mach',
  'bd_hrs',
  'bd_code',
  'bd_done',
  'bd_prob',
  'bd_shift',
  'bd_obs',
  'bd_em',
  'log_gap',
  'ww',
  'mc_age',
  'mc_dim',
  'mc_pw',
  'mc_cell',
  'mc_loc',
] as const;
export type GroupKey = (typeof GROUPS)[number];

/** v1's three parts of the data (`checklist-view.ts`), in v1's order: a group belongs to exactly one. */
export type Section = 'log' | 'machines' | 'analysis';
export const SECTION_ORDER: readonly Section[] = ['log', 'machines', 'analysis'];
export const SECTION_OF = (group: GroupKey): Section =>
  group === 'ww' ? 'analysis' : group.startsWith('mc_') ? 'machines' : 'log';
export const SECTION_LABEL: Record<Section, MessageKey> = {
  log: 'analytics.checklist.section.log',
  machines: 'analytics.checklist.section.machines',
  analysis: 'analytics.checklist.section.analysis',
};

/** ADR 0017 (a): who fixes a part of the data is a role, a person chip `{ kind: 'person', id: 'role:<role>' }`. */
export const OWNER_ROLE: Record<Section, 'supervisor' | 'admin' | 'head'> = {
  log: 'supervisor',
  machines: 'admin',
  analysis: 'head',
};
export const ROLE_LABEL: Record<'supervisor' | 'admin' | 'head', MessageKey> = {
  supervisor: 'account.role.supervisor',
  admin: 'account.role.admin',
  head: 'account.role.head',
};

/** ADR 0017 (d): the platform's "Low" groups change no figure on screen, so they are checks; every other is a gap. */
export const CHECK_ONLY: ReadonlySet<GroupKey> = new Set<GroupKey>(['bd_obs', 'bd_em']);

/** ADR 0017 (e): the one action of a check, by part of the data. Nothing is stored, so a check is never done. */
export const FIX: Record<Section, MessageKey> = {
  log: 'v2dc.fix.log',
  machines: 'v2dc.fix.machines',
  analysis: 'v2dc.fix.analysis',
};

/** How many machine chips a check's state names before "and N more". */
export const STATE_CHIPS = 4;

/**
 * The open items in the figure's value, in the engine's order: an entry that is not an object, or whose `group` is
 * not one of `GROUPS`, or whose `key` / `plain` is not a string, is dropped. A value that is not an object has none.
 */
export function itemsOf(value: unknown): ChecklistItem[] {
  void value;
  throw new Error('not built');
}

/**
 * The whole screen from the items and the date the engine ran for (`asOf`, `YYYY-MM-DD`): verdict, four KPIs, the
 * parts of the data that fail with their checks, every record, the checks that pass, the source line and the words.
 */
export function checklistModel(
  items: readonly ChecklistItem[],
  asOf: string,
  t: TFunction,
): DataChecklistModel {
  void items;
  void asOf;
  void t;
  throw new Error('not built');
}
