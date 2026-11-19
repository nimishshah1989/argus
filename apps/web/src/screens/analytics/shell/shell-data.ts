import { readsAnalytics } from '../../../roles.js';
import type { MessageKey } from '@uptimo/shared/i18n';
import {
  ACTION_CENTER_PATH,
  CHECKLIST_PATH,
  SCREEN_LABELS,
  groupFor,
  type GroupId,
} from '../groups.js';
import { mayReadMoney } from '../MoneyPage.js';

/**
 * The approved navigation map (ticket 80v) laid on the real analytics routes (86a). A section is one menu entry;
 * its tabs are real routes, never a third level. Every route of `groups.ts` sits under exactly one section
 * (`shell-data.test.ts` fails when one does not), and no route is renamed.
 */
export type SectionId =
  'today' | 'machines' | 'problems' | 'reliability' | 'people' | 'reports' | 'guide';

export interface ShellTab {
  /** The real route, with the query that picks the screen when the group page has several. */
  to: string;
  label: MessageKey;
  /** Money screens: hidden from a login the engine withholds money from (the server's own rule). */
  money?: boolean;
  /** The group whose own screens the search lists under this tab (a group page lists its screens here; Reports and Reliability list theirs as tabs instead). */
  group?: GroupId;
}

export interface ShellSection {
  id: SectionId;
  label: MessageKey;
  tabs: ShellTab[];
}

export const SECTIONS: readonly ShellSection[] = [
  {
    id: 'today',
    label: 'ashell.section.today',
    tabs: [
      { to: '/analytics/today', label: 'analytics.screen.dashboard' },
      { to: ACTION_CENTER_PATH, label: 'analytics.screen.action-center' },
      { to: CHECKLIST_PATH, label: 'analytics.screen.data-checklist' },
    ],
  },
  {
    id: 'machines',
    label: 'ashell.section.machines',
    tabs: [{ to: '/analytics/machines', label: 'ashell.section.machines', group: 'machines' }],
  },
  {
    id: 'problems',
    label: 'ashell.section.problems',
    tabs: [{ to: '/analytics/breakdowns', label: 'ashell.section.problems', group: 'breakdowns' }],
  },
  {
    id: 'reliability',
    label: 'ashell.section.reliability',
    tabs: [
      { to: '/analytics/forecast-scorecard', label: 'analytics.screen.a9-bottleneck-forecast' },
      {
        to: '/analytics/forecast-scorecard?screen=forecast-lab',
        label: 'analytics.screen.forecast-lab',
      },
    ],
  },
  {
    id: 'people',
    label: 'ashell.section.people',
    tabs: [
      { to: '/analytics/today?screen=team-focus', label: 'analytics.screen.team-focus' },
      { to: '/analytics/cost', label: 'analytics.screen.money-matters', money: true },
    ],
  },
  {
    id: 'reports',
    label: 'ashell.section.reports',
    tabs: [
      { to: '/analytics/reports', label: 'analytics.screen.monthly-report' },
      { to: '/analytics/reports?screen=annual-report', label: 'analytics.screen.annual-report' },
      { to: '/analytics/pm', label: 'pm.screen.calendar' },
    ],
  },
  {
    id: 'guide',
    label: 'ashell.section.guide',
    tabs: [{ to: '/analytics/guide', label: 'ashell.section.guide' }],
  },
];

/**
 * Which sections a login sees, by the app's own permission checks: supervisor, head, plant head and admin read
 * the figures; only the last three read money. Any other login (the floor, the board) gets the Guide alone.
 * While the role is still loading everything shows, and the server refuses what it must.
 */
export function sectionsFor(role: string | undefined): ShellSection[] {
  if (role !== undefined && !readsAnalytics(role))
    return SECTIONS.filter((section) => section.id === 'guide').map((section) => ({ ...section }));
  const money = role === undefined || mayReadMoney(role);
  return SECTIONS.map((section) => ({
    ...section,
    tabs: section.tabs.filter((tab) => money || !tab.money),
  }));
}

/** How well a tab fits a page: 0 no, 1 a page under the tab's route, 2 the route, 3 the route and its query. */
function fit(tab: ShellTab, pathname: string, search: URLSearchParams): number {
  const [path = '', raw = ''] = tab.to.split('?');
  if (pathname !== path) return pathname.startsWith(`${path}/`) ? 1 : 0;
  const query = new URLSearchParams(raw);
  for (const [key, value] of query) if (search.get(key) !== value) return 0;
  return query.size > 0 ? 3 : 2;
}

/** The section and tab a page belongs to; null for a path the map does not know. */
export function locate(
  pathname: string,
  search: string,
): { section: ShellSection; tab: ShellTab } | null {
  const params = new URLSearchParams(search);
  let best: { section: ShellSection; tab: ShellTab; score: number } | null = null;
  for (const section of SECTIONS)
    for (const tab of section.tabs) {
      const score = fit(tab, pathname, params);
      if (score > (best?.score ?? 0)) best = { section, tab, score };
    }
  return best;
}

/**
 * The section and tab to mark for a page, among the sections this login has. A page the login may not open (a
 * supervisor on the Money URL) is marked as nothing and the frame shows the first section it has instead.
 */
export function place(
  sections: readonly ShellSection[],
  pathname: string,
  search: string,
): { section: ShellSection; tab: ShellTab | null } {
  const found = locate(pathname, search);
  const section = sections.find((s) => s.id === found?.section.id);
  const tab = section?.tabs.find((t) => t.to === found?.tab.to);
  return tab && section ? { section, tab } : { section: sections[0] ?? SECTIONS[0]!, tab: null };
}

export interface SearchEntry {
  to: string;
  name: MessageKey;
  /** The section the entry sits in, or null when the entry is the section itself. */
  section: MessageKey | null;
}

/** Sections first, then their tabs, then the screens inside a group page: what the search can open. */
export function searchEntries(sections: readonly ShellSection[]): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const section of sections) {
    out.push({ to: section.tabs[0]!.to, name: section.label, section: null });
    if (section.tabs.length > 1)
      for (const tab of section.tabs)
        out.push({ to: tab.to, name: tab.label, section: section.label });
    for (const tab of section.tabs)
      for (const screen of tab.group ? (groupFor(tab.group)?.screens ?? []) : [])
        if (screen !== 'machine-page')
          out.push({
            to: `${tab.to}?screen=${screen}`,
            name: SCREEN_LABELS[screen]!,
            section: section.label,
          });
  }
  return out;
}
