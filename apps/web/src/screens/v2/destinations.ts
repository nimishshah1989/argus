import { createContext } from 'react';
import { FIGURES } from '@uptimo/domain';
import { fill } from '../../i18n/fill.js';
import type { Destination } from '../../ui/v2/drill.js';
import { ACTION_CENTER_PATH, SCREEN_LABELS, groupOfScreen } from '../analytics/groups.js';
import type { Translate } from './figures/read.js';
import { figureName } from './rows-behind/model.js';

/**
 * Where every card goes (Nimish, 26 Nov 2026; ADR 0058): one table, read by the kit itself through
 * `DestinationContext`, so a KPI card, a figure tile or a chart card that its screen's model did not wire still opens
 * something. A way is `rows` (an engine figure key: the drawer opens the rows behind it at `?drawer=figure:<key>`, the
 * rows `GET /analytics/drill` answers for that figure's drill type) or `home` (an engine screen id: the card links to
 * the page that explains it). A screen's own `drill` or `link` always wins over the map.
 */
export type Way = { rows?: string; home?: string };

/** The page that explains each engine figure: its own screen, except the Dashboard's, which each have a page of detail. */
const DASHBOARD_HOME: Record<string, string> = {
  'dashboard.total-machines': 'registers',
  'dashboard.utilities': 'registers',
  'dashboard.dg-sets': 'registers',
  'dashboard.cnc-machines': 'registers',
  'dashboard.conventional-machines': 'registers',
  'dashboard.process-machines': 'registers',
  'dashboard.expansion-timeline': 'registers',
  'dashboard.total-breakdowns': 'breakdown-log',
  'dashboard.total-downtime-hours': 'breakdown-log',
  'dashboard.no-downtime-hours': 'breakdown-log',
  'dashboard.plant-events': 'breakdown-log',
  'dashboard.avg-complaints-per-day': 'breakdown-log',
  'dashboard.avg-bd-hours-per-day': 'breakdown-log',
  'dashboard.pm-hours': 'a1-bd-pm',
  'dashboard.plant-bd-pct': 'a1-bd-pm',
  'dashboard.fleet-availability': 'a1-bd-pm',
  'dashboard.avg-bd-hours-per-machine': 'a2-category-cell',
  'dashboard.breakdown-free': 'a3-mttr-mtbf',
  'dashboard.costliest-problems': 'a10-problems',
  'dashboard.bubble-chart': 'compare',
  // One machine's figures have no one page: the register lists every machine and opens each one's page.
  'machine-page': 'registers',
  reliability: 'registers',
};

/** Every engine figure key and the screen that explains it. */
export const FIGURE_HOME: Readonly<Record<string, string>> = Object.fromEntries(
  FIGURES.map((figure) => [figure.key, DASHBOARD_HOME[figure.key] ?? figure.screen]),
);

/**
 * The cards of each screen, by the screen's engine id (the `LiveFrame` entry) and the card's id in its model. `*` is
 * the screen's default: the rows of the figure the whole page counts, named as that figure in the control, so a card
 * that counts a part of it ("Avg Age") opens the page's rows and says whose rows they are. A card id that is itself an
 * engine figure key (the Dashboard's) needs no line: it opens its rows, or its home page when the engine named none.
 */
export const CARDS: Readonly<Record<string, Readonly<Record<string, Way>>>> = {
  'action-center': { '*': { rows: 'action-center' } },
  'a8-age': { '*': { rows: 'a8-age' } },
  'a1-bd-pm': { '*': { rows: 'a1-bd-pm' } },
  'a9-bottleneck-forecast': {
    '*': { rows: 'a9-bottleneck-forecast' },
    'kpi-3': { home: 'a1-bd-pm' },
  },
  'a2-category-cell': { '*': { rows: 'a2-category-cell' } },
  'cell-change-log': { '*': { rows: 'cell-change-log' } },
  compare: { '*': { rows: 'compare' } },
  'data-checklist': { '*': { rows: 'data-checklist' } },
  'a5-energy': { '*': { rows: 'a5-energy' } },
  'fix-finder': { '*': { rows: 'fix-finder' } },
  'a7-footprint': { '*': { rows: 'a7-footprint' } },
  'forecast-lab': { '*': { rows: 'forecast-lab' } },
  // One machine's own facts each have a plant-wide page; its breakdown cards open its own rows (the model wires them).
  'machine-page': {
    age: { home: 'a8-age' },
    'floor-area': { home: 'a7-footprint' },
    'connected-load': { home: 'a5-energy' },
    'running-load': { home: 'a5-energy' },
    'pm-hours': { home: 'a1-bd-pm' },
  },
  registers: { '*': { rows: 'registers' } },
  'a4-manpower': { '*': { rows: 'a4-manpower' } },
  'money-matters': { '*': { rows: 'money-matters' }, 'kpi-9': { home: 'team-focus' } },
  'monthly-report': { '*': { rows: 'monthly-report' } },
  'a3-mttr-mtbf': { '*': { rows: 'a3-mttr-mtbf' } },
  'oem-analytics': { '*': { rows: 'oem-analytics' } },
  'pm-calendar': { '*': { rows: 'pm-compliance' } },
  'a10-problems': {
    '*': { rows: 'a10-problems' },
    'kpi-6': { home: 'a1-bd-pm' },
    'kpi-7': { home: 'a3-mttr-mtbf' },
  },
  'shift-kpis': { '*': { rows: 'shift-kpis.compare' } },
  'team-focus': { '*': { rows: 'team-focus' } },
};

/** A screen's address: its group's page with `?screen=`, the Dashboard and the Action Center at their own. */
export function screenHref(screen: string): string {
  if (screen === 'dashboard') return '/analytics/today';
  if (screen === 'action-center') return ACTION_CENTER_PATH;
  const group = groupOfScreen(screen);
  return group ? `/analytics/${group.id}?screen=${screen}` : '/analytics';
}

/** "Open MTTR and MTBF": the link to a screen, in the reader's words. */
export function openScreen(screen: string, t: Translate): { href: string; label: string } {
  const page = t(SCREEN_LABELS[screen] ?? 'analytics.screen.unknown');
  return { href: screenHref(screen), label: t('v2m.dest.open', { page }) };
}

/** The way a card on `scope` goes, before words: its own line, then its figure key's, then the screen's default. */
export function wayOf(scope: string, id: string): Way | undefined {
  const own = CARDS[scope]?.[id];
  if (own) return own;
  const home = FIGURE_HOME[id];
  // The screen's model already wired the figure's rows when the engine named any: no drill means none, so go home.
  if (home !== undefined) return { home };
  return CARDS[scope]?.['*'];
}

/** A card's destination on `scope`, in the reader's words; a home that is the page itself is no destination. */
export function destinationOf(scope: string, id: string, label: string, t: Translate): Destination {
  const way = wayOf(scope, id);
  if (way?.rows) {
    const figure = figureName(way.rows, t);
    const words =
      label === figure
        ? fill(t('v2m.rows.open'), { figure })
        : t('v2m.dest.rows', { figure, card: label });
    return { drill: { figure: way.rows, label: words } };
  }
  if (way?.home && way.home !== scope) return { link: openScreen(way.home, t) };
  return {};
}

/** The screen a live page is: `LiveFrame` provides it, so the rows drawer leaves out a link to the page it is on. */
export const ScopeContext = createContext('');

/**
 * The rows drawer's link to the page that explains the figure (a tile of the energy map, `a5-energy:cell:1`, by its
 * figure). One machine's own rows (`machine-page:<code>:…`) have their machine's page already: no link.
 */
export function homeLink(
  figure: string,
  scope: string,
  t: Translate,
): { href: string; label: string } | undefined {
  const base = figure.split(':')[0] ?? '';
  const home = base === figure || base !== 'machine-page' ? FIGURE_HOME[base] : undefined;
  return home && home !== scope ? openScreen(home, t) : undefined;
}
