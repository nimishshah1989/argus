import type { PmChecklistItem, PmPlanForJob } from '@uptimo/shared/pm';

/**
 * The PM close's draft and its body (ticket 49c, R8). The phone ticks the plan's points (all ticked at first) and
 * records the readings, the meter and one comment; the server derives `total` and `doneBy`, so the body carries
 * their placeholders and the plan id the close is allowed to move.
 */

export interface PmDraft {
  /** The tick item ids the technician could not do (`undone` on the stored report). */
  undone: string[];
  /** What was typed in each reading box, keyed by reading item id and the reserved `meter`; text until submit. */
  readings: Record<string, string>;
  comments: string;
}

/** The reserved reading key of the machine's meter (R6/R8). */
export const METER_KEY = 'meter';

export const emptyDraft = (): PmDraft => ({ undone: [], readings: {}, comments: '' });

/** The plan's tick items and its measured readings, in the plan's own order (R5). */
export function planItems(plan: PmPlanForJob | null): {
  ticks: PmChecklistItem[];
  readings: PmChecklistItem[];
  meter: boolean;
} {
  const items = plan?.checklist ?? [];
  return {
    ticks: items.filter((item) => item.kind === 'tick'),
    readings: items.filter((item) => item.kind === 'reading'),
    meter: plan?.meterInterval != null,
  };
}

/** A point is ticked unless it is on the undone list; every point starts ticked (the plan's own list). */
export function isTicked(draft: PmDraft, id: string): boolean {
  return !draft.undone.includes(id);
}

export function setTicked(draft: PmDraft, id: string, ticked: boolean): PmDraft {
  const without = draft.undone.filter((item) => item !== id);
  return { ...draft, undone: ticked ? without : [...without, id] };
}

export function setReading(draft: PmDraft, key: string, text: string): PmDraft {
  return { ...draft, readings: { ...draft.readings, [key]: text } };
}

/** A typed box as a number, or null when it is blank or not a number (the close then leaves it out). */
export function readingValue(text: string | undefined): number | null {
  const trimmed = (text ?? '').trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** The readings the body sends: every box with a number in it, and the meter (required on a meter plan). */
export function draftReadings(plan: PmPlanForJob | null, draft: PmDraft): Record<string, number> {
  const { readings, meter } = planItems(plan);
  const wanted = [...readings.map((item) => item.id), ...(meter ? [METER_KEY] : [])];
  const values: Record<string, number> = {};
  for (const key of wanted) {
    const value = readingValue(draft.readings[key]);
    if (value !== null) values[key] = value;
  }
  return values;
}

/** A close may be sent when every typed box is a number and a meter plan has its meter reading (R8's rule). */
export function pmReady(plan: PmPlanForJob | null, draft: PmDraft, pending = false): boolean {
  if (pending) return false;
  const { readings, meter } = planItems(plan);
  const numeric = readings.every((item) => {
    const text = draft.readings[item.id];
    return (text ?? '').trim() === '' || readingValue(text) !== null;
  });
  if (!numeric) return false;
  if (meter) return readingValue(draft.readings[METER_KEY]) !== null;
  return true;
}

/** The `close` body of a PM job: the plan id, the unticked points and the numbers; `total`/`doneBy` are placeholders. */
export function pmCloseBody(
  plan: PmPlanForJob | null,
  draft: PmDraft,
  at: Date,
): Record<string, unknown> {
  const pmReport = {
    ...(plan ? { planId: plan.id } : {}),
    total: 0,
    undone: [...draft.undone],
    readings: draftReadings(plan, draft),
    comments: draft.comments.trim() || null,
    doneBy: null,
  };
  return { kind: 'report', at: at.toISOString(), report: { pmReport } };
}
