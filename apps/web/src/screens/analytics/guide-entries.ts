import { FIGURES } from '@uptimo/domain';
import type { MessageKey } from '@uptimo/shared/i18n';
import { groupOfScreen } from './groups.js';

/**
 * The Guide's content (ticket 45, packet 45f): one entry per heading of the answer key's table of contents, in
 * the key's own order. Each entry states our rule in plain English, names the registered figures it explains and
 * flags the four features this build does not have yet. `guide-entries.test.ts` holds it to the key, the
 * registry and the menu's groups; `GuidePage.tsx` is the only renderer.
 */

export interface GuideEntry {
  /** The anchor and stable name, used by the contents and the entry's section id. */
  readonly id: string;
  /** The heading, verbatim from the key, resolved through the en catalogue. */
  readonly titleKey: MessageKey;
  /** The plain-English rule paragraphs, in reading order. */
  readonly bodyKeys: readonly MessageKey[];
  /** An optional formula line printed under the body. */
  readonly formulaKey?: MessageKey;
  /** The registered figure keys this entry explains; each one links to its real screen. */
  readonly figures: readonly string[];
  /** False for a feature this build does not have; absent means built. */
  readonly built?: boolean;
}

/** The one line the four unbuilt entries print instead of a rule. */
export const NOT_BUILT: MessageKey = 'analytics.guide.notBuilt';

/** The four features this build does not have, each with the entry id it fills. */
const UNBUILT: ReadonlySet<string> = new Set(['learning', 'no-code', 'amc-legal']);

interface EntryOptions {
  readonly figures?: readonly string[];
  readonly formula?: MessageKey;
}

/** One entry, with `built` derived from the unbuilt set so the two cannot drift. */
function entry(
  id: string,
  titleKey: MessageKey,
  bodyKeys: readonly MessageKey[],
  options: EntryOptions = {},
): GuideEntry {
  const figures = options.figures ?? [];
  return UNBUILT.has(id)
    ? { id, titleKey, bodyKeys: [NOT_BUILT], figures, built: false }
    : {
        id,
        titleKey,
        bodyKeys,
        figures,
        built: true,
        ...(options.formula === undefined ? {} : { formulaKey: options.formula }),
      };
}

export const GUIDE_ENTRIES: readonly GuideEntry[] = [
  entry('how', 'analytics.guide.how.title', [
    'analytics.guide.how.body1',
    'analytics.guide.how.body2',
  ]),
  entry('ground-rules', 'analytics.guide.ground-rules.title', [
    'analytics.guide.ground-rules.body1',
    'analytics.guide.ground-rules.body2',
    'analytics.guide.ground-rules.body3',
  ]),
  entry(
    'available-hours',
    'analytics.guide.available-hours.title',
    [
      'analytics.guide.available-hours.body1',
      'analytics.guide.available-hours.body2',
      'analytics.guide.available-hours.body3',
    ],
    {
      figures: ['shift-kpis.compare'],
      formula: 'analytics.guide.available-hours.formula',
    },
  ),
  entry(
    'dashboard',
    'analytics.guide.dashboard.title',
    ['analytics.guide.dashboard.body1', 'analytics.guide.dashboard.body2'],
    {
      figures: [
        'dashboard.total-machines',
        'dashboard.utilities',
        'dashboard.dg-sets',
        'dashboard.cnc-machines',
        'dashboard.conventional-machines',
        'dashboard.process-machines',
        'dashboard.total-breakdowns',
        'dashboard.total-downtime-hours',
        'dashboard.pm-hours',
        'dashboard.no-downtime-hours',
        'dashboard.costliest-problems',
        'dashboard.bubble-chart',
        'dashboard.expansion-timeline',
        'dashboard.plant-events',
        'dashboard.fleet-availability',
        'dashboard.plant-bd-pct',
        'dashboard.avg-complaints-per-day',
        'dashboard.avg-bd-hours-per-day',
        'dashboard.avg-bd-hours-per-machine',
      ],
    },
  ),
  entry(
    'mttr-mtbf',
    'analytics.guide.mttr-mtbf.title',
    [
      'analytics.guide.mttr-mtbf.body1',
      'analytics.guide.mttr-mtbf.body2',
      'analytics.guide.mttr-mtbf.body3',
      'analytics.guide.mttr-mtbf.body4',
      'analytics.guide.mttr-mtbf.body5',
    ],
    {
      figures: ['a3-mttr-mtbf', 'shift-kpis.shift-split', 'shift-kpis.backlog', 'reliability'],
      formula: 'analytics.guide.mttr-mtbf.formula',
    },
  ),
  entry(
    'bd-pm',
    'analytics.guide.bd-pm.title',
    ['analytics.guide.bd-pm.body1', 'analytics.guide.bd-pm.body2'],
    { figures: ['a1-bd-pm'], formula: 'analytics.guide.bd-pm.formula' },
  ),
  entry(
    'category-cell',
    'analytics.guide.category-cell.title',
    [
      'analytics.guide.category-cell.body1',
      'analytics.guide.category-cell.body2',
      'analytics.guide.category-cell.body3',
    ],
    { figures: ['a2-category-cell', 'shift-kpis.breakdown-map'] },
  ),
  entry(
    'age',
    'analytics.guide.age.title',
    ['analytics.guide.age.body1', 'analytics.guide.age.body2'],
    { figures: ['a8-age'], formula: 'analytics.guide.age.formula' },
  ),
  entry(
    'manpower',
    'analytics.guide.manpower.title',
    ['analytics.guide.manpower.body1', 'analytics.guide.manpower.body2'],
    { figures: ['a4-manpower'] },
  ),
  entry(
    'energy',
    'analytics.guide.energy.title',
    ['analytics.guide.energy.body1', 'analytics.guide.energy.body2'],
    { figures: ['a5-energy'] },
  ),
  entry(
    'why-why',
    'analytics.guide.why-why.title',
    ['analytics.guide.why-why.body1', 'analytics.guide.why-why.body2'],
    { figures: ['a6-why-why'] },
  ),
  entry(
    'footprint',
    'analytics.guide.footprint.title',
    ['analytics.guide.footprint.body1', 'analytics.guide.footprint.body2'],
    { figures: ['a7-footprint'] },
  ),
  entry(
    'machine-lists',
    'analytics.guide.machine-lists.title',
    ['analytics.guide.machine-lists.body1', 'analytics.guide.machine-lists.body2'],
    { figures: ['registers', 'machine-page'] },
  ),
  entry('excel', 'analytics.guide.excel.title', [
    'analytics.guide.excel.body1',
    'analytics.guide.excel.body2',
  ]),
  entry(
    'reports',
    'analytics.guide.reports.title',
    [
      'analytics.guide.reports.body1',
      'analytics.guide.reports.body2',
      'analytics.guide.reports.body3',
    ],
    { figures: ['monthly-report', 'annual-report'] },
  ),
  entry(
    'action-center',
    'analytics.guide.action-center.title',
    ['analytics.guide.action-center.body1', 'analytics.guide.action-center.body2'],
    { figures: ['action-center', 'action-center.spares-spend'] },
  ),
  entry(
    'data-checklist',
    'analytics.guide.data-checklist.title',
    ['analytics.guide.data-checklist.body1', 'analytics.guide.data-checklist.body2'],
    { figures: ['data-checklist'] },
  ),
  entry(
    'bottleneck',
    'analytics.guide.bottleneck.title',
    ['analytics.guide.bottleneck.body1', 'analytics.guide.bottleneck.body2'],
    { figures: ['a9-bottleneck-forecast'] },
  ),
  entry(
    'compare',
    'analytics.guide.compare.title',
    ['analytics.guide.compare.body1', 'analytics.guide.compare.body2'],
    { figures: ['compare', 'compare.spares-cost'] },
  ),
  entry('forecast-planning', 'analytics.guide.forecast-planning.title', [
    'analytics.guide.forecast-planning.body1',
    'analytics.guide.forecast-planning.body2',
  ]),
  entry(
    'trend-repeat',
    'analytics.guide.trend-repeat.title',
    ['analytics.guide.trend-repeat.body1', 'analytics.guide.trend-repeat.body2'],
    { figures: ['breakdown-log'] },
  ),
  entry(
    'cells-total',
    'analytics.guide.cells-total.title',
    ['analytics.guide.cells-total.body1', 'analytics.guide.cells-total.body2'],
    { figures: ['cell-change-log'] },
  ),
  entry('days-so-far', 'analytics.guide.days-so-far.title', ['analytics.guide.days-so-far.body1'], {
    formula: 'analytics.guide.days-so-far.formula',
  }),
  entry(
    'breakdown-free',
    'analytics.guide.breakdown-free.title',
    ['analytics.guide.breakdown-free.body1', 'analytics.guide.breakdown-free.body2'],
    { figures: ['dashboard.breakdown-free'] },
  ),
  entry(
    'health-score',
    'analytics.guide.health-score.title',
    ['analytics.guide.health-score.body1', 'analytics.guide.health-score.body2'],
    { formula: 'analytics.guide.health-score.formula' },
  ),
  entry(
    'problem-analysis',
    'analytics.guide.problem-analysis.title',
    ['analytics.guide.problem-analysis.body1', 'analytics.guide.problem-analysis.body2'],
    { figures: ['a10-problems'] },
  ),
  entry('sorting', 'analytics.guide.sorting.title', [
    'analytics.guide.sorting.body1',
    'analytics.guide.sorting.body2',
  ]),
  entry(
    'fix-finder',
    'analytics.guide.fix-finder.title',
    ['analytics.guide.fix-finder.body1', 'analytics.guide.fix-finder.body2'],
    { figures: ['fix-finder'] },
  ),
  entry(
    'forecast-lab',
    'analytics.guide.forecast-lab.title',
    ['analytics.guide.forecast-lab.body1', 'analytics.guide.forecast-lab.body2'],
    { figures: ['forecast-lab'] },
  ),
  entry(
    'team-focus',
    'analytics.guide.team-focus.title',
    ['analytics.guide.team-focus.body1', 'analytics.guide.team-focus.body2'],
    { figures: ['team-focus', 'team-focus.cost'] },
  ),
  entry(
    'money',
    'analytics.guide.money.title',
    ['analytics.guide.money.body1', 'analytics.guide.money.body2'],
    { figures: ['money-matters'] },
  ),
  entry('pm-calendar', 'analytics.guide.pm-calendar.title', ['analytics.guide.pm-calendar.body1'], {
    figures: ['pm-compliance'],
  }),
  entry('oem', 'analytics.guide.oem.title', ['analytics.guide.oem.body1'], {
    figures: ['oem-analytics'],
  }),
  entry('learning', 'analytics.guide.learning.title', []),
  entry('no-code', 'analytics.guide.no-code.title', []),
  entry('amc-legal', 'analytics.guide.amc-legal.title', []),
];

export interface GuideFigureLink {
  /** The registry figure key. */
  readonly figure: string;
  /** The registry screen that draws it. */
  readonly screen: string;
  /** The group page and the screen's own query: `/analytics/<group>?screen=<screen>`. */
  readonly href: string;
}

/**
 * The links one entry prints: each named figure's real screen, under the group the menu places it in. A key the
 * registry or the menu no longer has is a build error, not a silently missing link.
 */
export function guideFigureLinks(entry: GuideEntry): GuideFigureLink[] {
  return entry.figures.map((key) => {
    const figure = FIGURES.find((candidate) => candidate.key === key);
    if (figure === undefined) throw new Error(`the Guide names an unregistered figure: ${key}`);
    const group = groupOfScreen(figure.screen);
    if (group === null) throw new Error(`the Guide names a screen in no group: ${figure.screen}`);
    return {
      figure: key,
      screen: figure.screen,
      href: `/analytics/${group.id}?screen=${figure.screen}`,
    };
  });
}
