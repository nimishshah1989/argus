/**
 * The compare, team, money and fix-finder face (packet 43e): Compare's two charts and Money's one, Team Focus'
 * lanes and action defaults, the Today screen menu and Money's refusal line. Its own namespace, so the main
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
  'analytics.teamFocus.listTitle': "The month's actions",
  'analytics.teamFocus.openOf': '{{open}} open of {{total}}',
  'analytics.teamFocus.machine': 'Machine {{code}}',
  'analytics.teamFocus.stake': '{{hours}} hrs a month at stake',
  'analytics.teamFocus.status': 'Status: {{status}}',
  'analytics.teamFocus.owner': 'Owner: {{owner}}',
  'analytics.teamFocus.note': 'Note: {{note}}',
  'analytics.teamFocus.ownerNone': 'not assigned',
  'analytics.teamFocus.noteNone': 'none yet',
  'analytics.teamFocus.status.open': 'Not started',
  'analytics.teamFocus.status.prog': 'In progress',
  'analytics.teamFocus.status.done': 'Done',
  'analytics.teamFocus.status.skip': 'Not needed',
  'analytics.teamFocus.lane.A': 'Before next month',
  'analytics.teamFocus.lane.B': 'Fix for good',
  'analytics.teamFocus.lane.C': 'Overhaul or replace?',
  'analytics.teamFocus.lane.F': 'Why-Why due',
  'analytics.teamFocus.lane.D': 'Spares to keep ready',
  'analytics.teamFocus.lane.E': 'Fix the record',
  'analytics.teamFocus.hint.A':
    'Machines the forecast expects to lose the most time. Inspect and prepare before the month starts.',
  'analytics.teamFocus.hint.B':
    'Problems that keep coming back or cost the most hours. These need a permanent fix, not another repair.',
  'analytics.teamFocus.hint.C':
    'Machines losing far more hours than expected for their age and category.',
  'analytics.teamFocus.hint.F': 'Long breakdowns that still have no root-cause analysis.',
  'analytics.teamFocus.hint.D':
    'Parts used again and again, so the next repair does not wait for them.',
  'analytics.teamFocus.hint.E': 'Gaps in the logging that make every forecast and analysis weaker.',
  'analytics.money.refusedTitle': 'Money Matters is for heads and admin',
  'analytics.money.refusedBody':
    'The money figures are held back from this login; the analytics profile hides its money settings too. Ask a head or an admin to open this page.',
};
