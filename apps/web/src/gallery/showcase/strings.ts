import i18n from '../../i18n/index.js';

/** The showcase's English words, in the `showcase` namespace. Gujarati is not shown on this screen. */
const en = {
  title: 'Analytics overview',
  plant: 'Cosmos Engitech',
  period: 'January to {{date}}',
  updated: 'Data up to {{date}}',
  machines: '{{n}} machines',
  inProgress: '{{month}} is still running, so its totals are not compared with a full month.',

  'tile.availability': 'Plant availability',
  'tile.downtime': 'Breakdown downtime',
  'tile.breakdowns': 'Breakdowns',
  'tile.mtbf': 'Time between breakdowns',
  'tile.mttr': 'Time to repair',
  'tile.pm': 'Planned maintenance',
  'unit.pts': 'pts',
  'unit.h': 'h',
  'delta.more': '{{n}} more in {{to}} than in {{month}}',
  'delta.less': '{{n}} less in {{to}} than in {{month}}',
  'delta.same': 'Same in {{to}} as in {{month}}',
  'delta.none': 'No earlier month to compare',
  'delta.better': 'better',
  'delta.worse': 'worse',
  'delta.planned': 'planned work',
  'tile.open': 'Explain this figure',
  'tile.span': 'Year to date',

  'sheet.close': 'Close',
  'sheet.definition': 'What it is',
  'sheet.formula': 'How it is worked out',
  'sheet.months': 'The months behind it',
  'sheet.month': 'Month',
  'sheet.value': 'Value',
  'sheet.change': 'Change',
  'sheet.running': 'in progress',
  'sheet.source': 'Worked out from the plant’s breakdown and maintenance tickets.',
  'def.availability':
    'The share of working hours that machines were free to run, not stopped by a breakdown or by planned maintenance.',
  'def.downtime':
    'The hours machines stood still because of breakdowns, from the report to the restore. Planned maintenance is not counted here.',
  'def.breakdowns': 'How many times a machine stopped because something failed.',
  'def.mtbf':
    'Also called MTBF. How long a machine runs, on average, before the next breakdown. Longer is better.',
  'def.mttr':
    'How long it takes, on average, to get a stopped machine running again. Shorter is better.',
  'def.pm':
    'The hours machines were stopped on purpose for planned maintenance. It prevents breakdowns, so it is not good or bad by itself.',
  'formula.availability':
    '100 % minus (breakdown hours plus planned maintenance hours) divided by available hours.',
  'formula.downtime': 'The sum of the hours recorded on every breakdown ticket in the period.',
  'formula.breakdowns': 'The number of breakdown tickets in the period.',
  'formula.mtbf': '(Available hours minus breakdown hours) divided by the number of breakdowns.',
  'formula.mttr': 'Breakdown hours divided by the number of breakdowns.',
  'formula.pm': 'The sum of the hours recorded on every planned maintenance ticket in the period.',

  'trend.title': 'Trend by month',
  'trend.availability': 'Availability',
  'trend.downtime': 'Downtime hours',
  'trend.mtbf': 'Time between breakdowns',
  'toggle.availability': 'Availability',
  'toggle.downtime': 'Downtime',
  'toggle.mtbf': 'MTBF',
  'delta.up': '{{n}} up on {{month}}',
  'delta.down': '{{n}} down on {{month}}',
  'pareto.line': 'Passes 80 %',
  'trend.metric': 'Show',
  'trend.range': 'Usual range',
  'trend.big': 'Breakdown over {{n}} h',
  'trend.sum': '{{metric}} in {{month}} was {{value}}.',
  'tip.vs': 'vs {{month}}',
  'tip.range': 'Usual range',
  'tip.within': 'Within {{lo}} to {{hi}}',
  'tip.above': 'Above {{hi}}',
  'tip.below': 'Below {{lo}}',
  'tip.breakdowns': 'Breakdowns',
  'tip.cause': 'Top cause',
  'tip.machine': 'Worst machine',
  'tip.longest': 'Longest',
  'tip.running': 'In progress, to {{date}}',

  'pareto.title': 'Where the downtime comes from',
  'pareto.sum': 'The top {{n}} causes make up {{pct}} % of breakdown hours.',
  'pareto.hours': 'Hours',
  'pareto.cum': 'Cumulative share',
  'pareto.count': '{{n}} breakdowns',
  'pareto.machines': 'Mostly on',

  'heat.title': 'Which machines lose the most',
  'heat.sum': '{{machine}} lost {{hours}} h in {{month}}, the most of any machine in a month.',
  'heat.caption': 'Breakdown hours by machine and month',
  'heat.machine': 'Machine',
  'heat.note': 'Each square prints its breakdown hours. Point at one to read it in full.',
  'heat.less': 'Fewer hours',
  'heat.more': 'More hours',

  'cells.title': 'Every cell against the plant',
  'cells.sum': '{{n}} of {{total}} cells lost less time to breakdowns than the plant in {{month}}.',
  'cells.note': 'Breakdown share of available hours, by month. The dotted line is the plant.',
  'cells.latest': '{{month}}',
  'cells.plant': 'Plant {{value}}',
  'cells.lower': 'lower than the plant',
  'cells.higher': 'higher than the plant',
  'cells.noRecords': 'No records yet',
};

export type ShowcaseKey = keyof typeof en;

i18n.addResourceBundle('en', 'showcase', en, true, true);
i18n.addResourceBundle('gu', 'showcase', en, true, true);
