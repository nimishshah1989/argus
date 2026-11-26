/**
 * The Reports face (packet 45e): the group's Monthly | Annual menu, the two download links, the commentary
 * caption, the period line and the four report charts' chrome. Its own namespace, so the main analytics
 * catalogue and this screen's copy never edit one file and both stay under the 250-line catalogue cap.
 */
export const analyticsReportEn = {
  'analytics.report.downloadPdf': 'Download PDF',
  'analytics.report.downloadWorkbook': 'Export the whole data set (Excel)',
  'analytics.report.commentary': 'Management commentary and actions',
  'analytics.report.periodMonthly': '{{month}} {{year}}',
  'analytics.report.periodAnnual': '{{year}} to {{date}}',
  'analytics.report.empty': 'Nothing was recorded in this period, so this report is empty.',
  'analytics.content.report.dailyChart': 'Breakdowns and hours, day by day',
  'analytics.content.report.monthsChart': 'Breakdowns and hours, month by month',
  'analytics.content.report.yearMonthsChart': 'Breakdowns and hours, month by month this year',
  'analytics.content.report.paretoChart': 'Where the downtime comes from',
  'analytics.content.report.dayAxis': 'Day',
  'analytics.content.report.monthAxis': 'Month',
  'analytics.content.report.machineAxis': 'Machine',
  // S23 Monthly Report (v2): the verdict, the source line and one takeaway per section (ADR 0035).
  'monthly-report.source':
    'Source: the breakdown log of the production machines, the complete month against the one before it. Records to {date}.',
  'monthly-report.headline': '{period}: {n} breakdowns lost {hours} hours of production.',
  'monthly-report.against': '{month} lost {hours} hours, against {before} hours in {previous}.',
  'monthly-report.daily': '{day} {month} lost the most: {hours} h in {n} breakdowns.',
  'monthly-report.months': '{month} lost the most downtime of the year: {hours} h.',
  'monthly-report.rank': '{name}: {hours} h, {change} on {previous}.',
  'monthly-report.longest': '{machine} on {date}: {hours} h, {times}× the next longest.',
  'monthly-report.longestOnly': '{machine} on {date}: {hours} h.',
  'monthly-report.team': '{name} attended {share} of breakdowns.',
  'monthly-report.added':
    '{n} machines were added this period; {category} added the most ({most}).',
  'monthly-report.more': 'and {n} more rows',
  // S24 Annual Report (v2): the verdict, the source line, one takeaway per section (ADR 0035) and the charts' words.
  'annual-report.source':
    'Source: the breakdown log of the production machines, the year so far. Records to {date}.',
  'annual-report.headline':
    '{period}: {n} breakdowns lost {hours} hours of production. {month} was the worst month ({monthHours} h); {machine} cost the most ({share} of the year).',
  'annual-report.months': '{month} lost the most downtime of the year: {hours} h.',
  'annual-report.quarters': '{quarter} lost the most downtime: {hours} h.',
  'annual-report.machines':
    '{machine} cost the most: {hours} h, {share} of the year. The top {n} make {cum}.',
  'annual-report.cells': '{cell} loses the most per machine: {hours} h a machine.',
  'annual-report.causes': '{code}: {hours} h, {share} of the downtime.',
  'annual-report.categories': '{category} is the least reliable: {hours} h a machine.',
  'annual-report.age': 'Machines aged {band} lose the most: {hours} h a machine.',
  'annual-report.team': '{name} attended the most breakdowns: {n}.',
  'annual-report.pm': '{month} had the most PM hours: {hours} h. Months with no PM entry: {none}.',
  'annual-report.added': '{n} machines were added this year; {category} added the most ({most}).',
  'annual-report.monthBar': '{hours} h · {n} breakdowns',
  'annual-report.toDate': 'to date',
  'annual-report.worst': 'Worst month',
  'annual-report.costliest': 'Costliest',
  'annual-report.machineBar': '{hours} h · {share}',
  'annual-report.tail':
    '{n} more of the {total}: {hours} h together, {share} of the year by the last',
  'annual-report.ageBar': '{hours} h a machine · {n} machines',
  'annual-report.pmBar': '{hours} h · {n} entries',
  'annual-report.noPm': 'No PM',
  'annual-report.longestMark': 'Longest',
  'annual-report.part': '{n} of {total}',
};
