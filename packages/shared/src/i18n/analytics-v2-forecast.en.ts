/**
 * The words of the v2 Energy, Bottleneck, Forecast Lab and Shift-calendar KPIs screens that are not the engine's own
 * printed text. `{name}` is filled by the screen (`fill`), not by i18next. A key the Gujarati file does not give shows
 * the English (D7); there is no Hindi catalogue yet.
 */
export const analyticsV2ForecastEn = {
  // Energy.
  'v2e.title': 'Energy Heatmap',
  'v2e.source':
    'Source: the plant’s machine list, each machine’s rated power and its cell and location. Records to {date}.',
  'v2e.noFigures': 'The engine printed no load for this plant.',
  'v2e.headline':
    '{cell} carries the most connected load: {kva} of the plant’s {total} across {machines} machines.',
  'v2e.running':
    'Running load is the connected load times the efficiency factor, {pct}% as the plant default.',
  'v2e.densest': '{cell} has the heaviest machines on average: {avg} each.',
  'v2e.fig.connected': 'Connected load',
  'v2e.fig.connectedSub': 'the total rated power of {n} machines',
  'v2e.fig.running': 'Running load',
  'v2e.fig.runningSub': 'estimated at {pct}% of connected',
  'v2e.fig.heaviest': 'Heaviest cell',
  'v2e.fig.densest': 'Heaviest machines',
  'v2e.fig.perMachine': 'a machine',
  'v2e.heat.low': 'Lighter load',
  'v2e.heat.high': 'Heavier load',
  'v2e.tile.open': 'Show the machines behind {name}',
  // Bottleneck.
  'v2b.title': 'Bottleneck Analysis',
  'v2b.source':
    'Source: the breakdown log of the production machines, their categories and cells, and the planning forecast. Records to {date}.',
  'v2b.headline':
    '{critical} machines could stall production and {high} more need a close watch; {single} have no backup machine.',
  'v2b.plan': 'For next month, plan for {plan}; the worst case is {worst}.',
  'v2b.top':
    '{machine} ranks first on risk: score {score} ({rating}), available {availability} of the time.',
  'v2b.map.sub': '{n} machines by breakdown hours and breakdowns',
  'v2b.map.aria': '{title}. {n} machines, sized by risk.',
  // Forecast Lab.
  'v2l.source':
    'Source: the breakdown log of the production machines, forecast month by month and compared with what happened. Records to {date}.',
  'v2l.headline':
    'Over the last {months} months the model in use scored {score} (lower is better); {decision}.',
  'v2l.noneBetter': 'no other method is good enough to replace it',
  'v2l.adopt': '{n} other methods can be adopted',
  'v2l.best': '{method} scored best on accuracy ({score}). {verdict}',
  'v2l.track': 'The plant stayed inside the model in use’s 80% range in {inside} months.',
  // Shift-calendar KPIs.
  'v2s.source':
    'Source: the breakdown log of the production machines, on the plant’s shift windows. Records to {date}.',
  'v2s.headline':
    'On working hours a machine runs {mtbf} hrs between breakdowns ({platform} on the platform basis); a breakdown takes {mttr} hrs to fix and availability is {availability}%.',
  'v2s.backlog': '{open} breakdowns are still open; the oldest has waited {oldest} working hours.',
  'v2s.half': 'Half of the breakdown hours come from {machines} machines, in {cells} cells.',
  'v2s.heat.low': 'Fewer hours',
  'v2s.heat.high': 'More hours',
  'v2s.heat.cell': '{row}, {column}: {value}',
  'v2s.heat.none': 'no hours',
} as const;
