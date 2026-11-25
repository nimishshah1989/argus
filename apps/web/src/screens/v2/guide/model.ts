import type { MessageKey } from '@uptimo/shared/i18n';
import { GUIDE_ENTRIES, type GuideEntry } from '../../analytics/guide-entries.js';

/** The eight topics the wireframe files the guide under (S25), in chip order. */
export type GuideGroup =
  | 'basics'
  | 'overview'
  | 'reliability'
  | 'problems'
  | 'machines'
  | 'people-money'
  | 'reports-data'
  | 'planning';
export type GuideChipId = 'all' | GuideGroup | 'unbuilt';
export type GuideChip = { id: GuideChipId; label: MessageKey; count: number };
/** One entry as the page draws it: `n` is its number (null for "How this platform works"), `anchor` is `guide-<id>`. */
export type GuideItem = {
  entry: GuideEntry;
  n: number | null;
  anchor: string;
  group: GuideGroup | null;
};
export type GuideModel = {
  /** All, the eight groups, then Not built yet; counts from the entries. */
  chips: GuideChip[];
  /** Every entry in data order: the contents list draws all of them whatever chip is on. */
  items: GuideItem[];
  /** The group with the most entries (first in chip order on a tie), its count, the total and the unbuilt count. */
  takeaway: { group: GuideGroup; n: number; total: number; unbuilt: number };
};

/** Each entry's topic, from the approved wireframe; null for the four this build does not have. */
export const GROUP_OF: Readonly<Record<string, GuideGroup | null>> = {
  how: 'basics',
  'ground-rules': 'basics',
  'available-hours': 'basics',
  dashboard: 'overview',
  'mttr-mtbf': 'reliability',
  'bd-pm': 'reliability',
  'category-cell': 'problems',
  age: 'problems',
  manpower: 'people-money',
  energy: 'machines',
  'why-why': 'problems',
  footprint: 'machines',
  'machine-lists': 'machines',
  excel: 'reports-data',
  reports: 'reports-data',
  'action-center': 'overview',
  'data-checklist': 'reports-data',
  bottleneck: 'problems',
  compare: 'machines',
  'forecast-planning': 'planning',
  'trend-repeat': 'problems',
  'cells-total': 'basics',
  'days-so-far': 'basics',
  'breakdown-free': 'reliability',
  'health-score': 'machines',
  'problem-analysis': 'problems',
  sorting: 'basics',
  'fix-finder': 'problems',
  'forecast-lab': 'planning',
  'team-focus': 'people-money',
  money: 'people-money',
  'pm-calendar': 'planning',
  oem: null,
  learning: null,
  'no-code': null,
  'amc-legal': null,
};

const GROUPS: readonly GuideGroup[] = [
  'basics',
  'overview',
  'reliability',
  'problems',
  'machines',
  'people-money',
  'reports-data',
  'planning',
];

/**
 * The Guide's page. Chip labels: `analytics.guide.all`, `analytics.guide.group.<group>`, `analytics.guide.unbuilt`.
 * An entry is "Not built yet" when `built === false`; its group is then null.
 */
export function guideModel(entries: readonly GuideEntry[] = GUIDE_ENTRIES): GuideModel {
  let n = 0;
  const items = entries.map((entry): GuideItem => {
    const group = entry.built !== false ? (GROUP_OF[entry.id] ?? null) : null;
    return { entry, n: entry.id === 'how' ? null : ++n, anchor: `guide-${entry.id}`, group };
  });
  const unbuilt = items.filter((i) => i.entry.built === false).length;
  const chips: GuideChip[] = [
    { id: 'all', label: 'analytics.guide.all', count: items.length },
    ...GROUPS.map((id) => ({
      id,
      label: `analytics.guide.group.${id}` as MessageKey,
      count: items.filter((i) => i.group === id).length,
    })),
    { id: 'unbuilt', label: 'analytics.guide.unbuilt', count: unbuilt },
  ];
  const top = chips.slice(1, -1).reduce((a, b) => (b.count > a.count ? b : a));
  return {
    chips,
    items,
    takeaway: { group: top.id as GuideGroup, n: top.count, total: items.length, unbuilt },
  };
}

/** The entries a chip shows: all of them, one group's, or the unbuilt ones; data order kept. */
export function shownEntries(model: GuideModel, chip: GuideChipId): GuideItem[] {
  if (chip === 'all') return model.items;
  return model.items.filter((i) =>
    chip === 'unbuilt' ? i.entry.built === false : i.group === chip,
  );
}
