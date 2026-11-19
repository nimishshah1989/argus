import type { MessageKey } from '@uptimo/shared/i18n';

/**
 * The data checklist's totals (ticket 87), read from the engine's own per-group counts: how many things are still
 * to do, and how many of those sit in the breakdown log, in the machine records and in the analysis. A group the
 * engine does not count in one of these three is still in the total. Nothing is invented: a missing count is 0
 * items, and a figure that is not an object has no totals at all.
 */

export type ChecklistSection = 'log' | 'machines' | 'analysis';

export const SECTION_LABELS: Record<ChecklistSection, MessageKey> = {
  log: 'analytics.checklist.section.log',
  machines: 'analytics.checklist.section.machines',
  analysis: 'analytics.checklist.section.analysis',
};

export const SECTION_ORDER: readonly ChecklistSection[] = ['log', 'machines', 'analysis'];

export interface ChecklistTotals {
  total: number;
  sections: Record<ChecklistSection, number>;
}

/** Which section a group id belongs to: the breakdown-log gaps, the machine-record gaps, or the Why-Why analysis. */
function sectionOf(group: string): ChecklistSection | null {
  if (group.startsWith('bd_') || group === 'log_gap') return 'log';
  if (group.startsWith('mc_')) return 'machines';
  return group === 'ww' ? 'analysis' : null;
}

export function checklistTotals(value: unknown): ChecklistTotals | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const counts = (value as { counts?: unknown }).counts;
  const totals: ChecklistTotals = { total: 0, sections: { log: 0, machines: 0, analysis: 0 } };
  if (typeof counts !== 'object' || counts === null) return totals;
  for (const [group, raw] of Object.entries(counts)) {
    const count = Number(raw);
    if (!Number.isFinite(count) || count <= 0) continue;
    totals.total += count;
    const section = sectionOf(group);
    if (section !== null) totals.sections[section] += count;
  }
  return totals;
}
