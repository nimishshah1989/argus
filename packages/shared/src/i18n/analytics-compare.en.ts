/**
 * The compare, team, money and fix-finder face (packet 43e): Compare's two charts and Money's one,
 * the Today screen menu and Money's refusal line. Its own namespace, so the main
 * analytics catalogue stays under the 250-line cap. Every key keeps its `analytics.` prefix, so the face
 * reads one flat catalogue.
 */
export const analyticsCompareEn = {
  'analytics.content.cmp.codeChart': 'BD hours by maintenance code',
  'analytics.content.cmp.codeAxis': 'Maintenance code',
  'analytics.content.cmp.monthChart': 'BD hours by month',
  'analytics.content.cmp.monthAxis': 'Month',
  'analytics.content.cmp.hoursAxis': 'BD hours',
  'analytics.content.mm.chart': 'Where the money was lost',
  'analytics.content.mm.problemAxis': 'Problem',
  'analytics.content.mm.value': 'Money lost (₹ lakh)',
  'analytics.content.mm.valueAxis': 'Money lost in the period (₹ lakh)',
  'analytics.unit.points': 'pts',
  'analytics.today.vs': 'Changes are against {{date}}, {{days}} days earlier',
  'analytics.today.rowsFor': 'See the rows for {{figure}}',
  'analytics.today.added': '{{amount}} in {{days}} days',
  'analytics.today.costliest.line_one': '{{hours}} · {{share}} · {{count}} breakdown',
  'analytics.today.costliest.line_other': '{{hours}} · {{share}} · {{count}} breakdowns',
  'analytics.money.refusedTitle': 'Money Matters is for heads and admin',
  'analytics.money.refusedBody':
    'The money figures are held back from this login; the analytics profile hides its money settings too. Ask a head or an admin to open this page.',
};
