import type { AmcLine, LegalLine, NudgeAck } from '../../src/index.js';
import { read } from './keys.js';
import type { Workbook } from './workbook.js';

/**
 * The Action Center's answer-key seam (ticket 44): the frozen 11 November key and the workbook inputs it needs
 * beside the breakdown rows. It lives in its own module because `fixture.ts` is at its line budget; `fixture.ts`
 * re-exports all of it, so a test keeps one import.
 */

/** One Action Center nudge as the key holds it: the six fields, and none of the platform's prose. */
export interface ActionCenterKeyNudge {
  key: string;
  rule: string;
  sev: string;
  title: string;
  machines: string[];
  entries: number;
}

/** The key's payload: its 16 type labels, 26 thresholds, six saved acks and 36 nudges. */
export interface ActionCenterKey {
  screen: string;
  asOf: string;
  pages: unknown[];
  extra: {
    types: Record<string, string>;
    thresholds: Record<string, number>;
    acks: Record<string, NudgeAck>;
    nudges: ActionCenterKeyNudge[];
  };
}

/** What the platform showed for `input.json` on 2026-11-11. */
export const ACTION_CENTER: ActionCenterKey = read<ActionCenterKey>('action-center.json');

const text = (value: string | undefined): string | null =>
  value !== undefined && String(value).trim() !== '' ? String(value).trim() : null;

const number = (value: number | string | undefined): number | null => {
  if (value === undefined || (typeof value === 'string' && value.trim() === '')) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** The six saved acknowledgements: `input.json`'s acks, never read out of the answer key. */
export const nudgeAcks = (workbook: Workbook): Record<string, NudgeAck> =>
  workbook.settings.acAcks ?? {};

/** The AMC lines as the reminder rule reads them; the workbook gives them no id, so one is derived. */
export function amcLines(workbook: Workbook): AmcLine[] {
  return (workbook.settings.machAmc ?? []).map((line, index) => ({
    id: line.id ?? `amc-${index + 1}`,
    machineId: line.machineId,
    type: text(line.type),
    start: text(line.start),
    months: number(line.months) ?? 0,
    vendor: text(line.vendor),
    noRenew: line.noRenew === true,
  }));
}

/** The legal lines as the reminder rule reads them, with a derived id where the workbook has none. */
export function legalLines(workbook: Workbook): LegalLine[] {
  return (workbook.settings.machLegal ?? []).map((line, index) => ({
    id: line.id ?? `legal-${index + 1}`,
    machineId: line.machineId,
    tid: line.tid ?? '',
    name: line.name ?? '',
    form: text(line.form),
    last: text(line.last),
    months: number(line.months) ?? 0,
    cert: text(line.cert),
  }));
}
