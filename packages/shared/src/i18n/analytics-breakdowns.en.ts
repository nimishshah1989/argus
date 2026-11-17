/**
 * The breakdowns face (ticket 40, packet 40e-1): the Breakdown Log's filters, export and count, and the chrome
 * around the A1 page's two charts. Its own namespace, so the log/A1 screens never edit the analytics core.
 */
export const analyticsBreakdownsEn = {
  'analytics.breakdowns.nav': 'Breakdowns screens',
  'analytics.log.intro':
    'Every breakdown and PM entry the plant logged, newest first. The log keeps the PM rows; the analyses leave them out. A NO DT entry prints a dash, never zero hours.',
  'analytics.log.filter.title': 'Filter the log',
  'analytics.log.filter.date': 'Date',
  'analytics.log.filter.shift': 'Shift',
  'analytics.log.filter.machine': 'Machine',
  'analytics.log.filter.code': 'Code',
  'analytics.log.filter.all': 'All',
  'analytics.log.rows': '{{rows}} rows',
  'analytics.log.truncated': 'showing the newest {{shown}} of {{total}}',
  'analytics.log.matching': '{{matching}} match these filters',
  'analytics.log.noMatches': 'No rows match these filters.',
  'analytics.log.export': 'Export to CSV',
  'analytics.log.exportError': 'Could not export the breakdown log.',
  'analytics.log.openTicket': 'Open the ticket for Sr No {{srNo}}',
  'analytics.log.empty': 'No breakdown log entries yet.',
  'analytics.content.a1.cellChart': 'BD % and PM % by cell',
  'analytics.content.a1.cellAxis': 'Cell',
  'analytics.content.a1.trendChart': 'BD and PM hours by month',
  'analytics.content.a1.trendAxis': 'Month',
  'analytics.page.drillTooMany':
    '{{tickets}} tickets are behind this page; open them one by one in the Breakdown log.',
  'analytics.page.openLog': 'Open the Breakdown log',
};
