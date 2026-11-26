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
  'monthly-report.rank': '{name}: {hours} h, {change} h on {previous}.',
  'monthly-report.rankOnly': '{name}: {hours} h.',
  'monthly-report.againstColumn': 'Against {month}',
  'monthly-report.longest': '{machine} on {date}: {hours} h, {times}× the next longest.',
  'monthly-report.longestOnly': '{machine} on {date}: {hours} h.',
  'monthly-report.team': '{name} attended {share} of breakdowns.',
  'monthly-report.added':
    '{n} machines were added this period; {category} added the most ({most}).',
  'monthly-report.more': 'and {n} more rows',
};
