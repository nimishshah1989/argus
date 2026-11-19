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
};
