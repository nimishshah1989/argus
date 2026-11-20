import type { NudgeRule, NudgeSeverity, NudgeStatus } from '@uptimo/shared';
import { PAGE_SIZE, tablePage, type SortDir } from '../../../ui/v2/table-model.js';
import type { NudgeRow } from './model.js';

/** What the reader has asked of the list: the tab, the type, the search, the priority chip, a sort and a page. */
export type NudgeAsk = {
  status: NudgeStatus;
  /** A kind, or '' for all. */
  type: NudgeRule | '';
  query: string;
  /** A priority, or '' for all. */
  priority: NudgeSeverity | '';
  sort?: { key: string; dir: SortDir };
  page: number;
};

export type NudgeView = {
  /** The page of rows to draw: the engine's order unless a sort was asked, ten at a time. */
  rows: NudgeRow[];
  total: number;
  page: number;
  /** The rows the tab, the type and the search leave, counted by priority: what each priority chip prints. */
  counts: Record<NudgeSeverity | 'all', number>;
};

const SORTS: Record<string, (row: NudgeRow) => number | string> = {
  priority: (r) => r.weight,
  nudge: (r) => r.titleText,
  type: (r) => r.ruleLabel,
  entries: (r) => r.count,
  latest: (r) => r.latest.value,
  status: (r) => r.statusLabel,
};

/**
 * The list one ask leaves, and what each priority chip counts. The counts are taken from the same rows the table
 * draws (the tab, the type and the search applied, the priority chip not yet), so a chip says how many it will show.
 */
export function nudgeView(nudges: readonly NudgeRow[], ask: NudgeAsk): NudgeView {
  const text = (r: NudgeRow) => r.text;
  const inTab = nudges.filter(
    (n) => n.status === ask.status && (ask.type === '' || n.rule === ask.type),
  );
  const scoped = tablePage(inTab, {
    query: ask.query,
    text,
    page: 1,
    size: Math.max(inTab.length, 1),
  }).rows;
  const counts = { all: scoped.length, high: 0, med: 0, low: 0, info: 0 };
  for (const n of scoped) counts[n.severity] += 1;
  const shown = tablePage(scoped, {
    query: '',
    text,
    filter: ask.priority === '' ? undefined : (r) => r.severity === ask.priority,
    sortBy: ask.sort ? SORTS[ask.sort.key] : undefined,
    dir: ask.sort?.dir,
    page: ask.page,
    size: PAGE_SIZE,
  });
  return { rows: shown.rows, total: shown.total, page: shown.page, counts };
}
