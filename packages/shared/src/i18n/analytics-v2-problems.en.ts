/**
 * The words of the v2 Problems screens (Breakdown Log, General Work, PM Calendar, Fix Finder, Problem Analysis) that
 * are not the engine's own printed text. `{name}` is filled by the screen (`fill`), not by i18next. Gujarati is a
 * blank placeholder until the translation sweep; there is no Hindi catalogue yet.
 */
export const analyticsV2ProblemsEn = {
  // Shared by every table and card on these screens.
  'v2p.why': 'Why?',
  'v2p.showing': '{from}–{to} of {total}',
  'v2p.noResults': 'Nothing matches this filter.',
  'v2p.open': 'Open',
  'v2p.all': 'All',
  'v2p.date': 'Date',
  'v2p.machine': 'Machine',
  'v2p.problem': 'Problem',
  'v2p.doneBy': 'Done by',
  'v2p.nobody': 'Nobody recorded',
  // Fix Finder.
  'v2p.ff.title': 'Similar breakdowns across the plant',
  'v2p.ff.headline': '{count} similar breakdowns found, typically down {typical}.',
  'v2p.ff.noFigures': 'The engine found no similar breakdowns.',
  'v2p.ff.lastSeen': 'The most recent one was on {date}.',
  'v2p.ff.source':
    'Source: the breakdown log, production machines, PM left out. Records to {date}.',
  'v2p.ff.search': 'Search {n} similar breakdowns',
  'v2p.ff.match': 'Match',
  'v2p.ff.done': 'What was done',
  'v2p.ff.down': 'Down (hrs)',
  'v2p.ff.full': '100% match',
  'v2p.ff.partial': 'Part match',
  // Problem Analysis.
  'v2p.pa.title': 'Problem Analysis',
  'v2p.pa.remove': 'Remove',
  'v2p.pa.whatIf': 'What if the top problem group were cut',
  'v2p.pa.search': 'Search this table',
  'v2p.pa.barSub': 'Breakdown hours for each problem group, biggest first.',
  'v2p.pa.barAria': 'Bar chart of breakdown hours for the {n} biggest problem groups.',
  'v2p.pa.scatterSub':
    'Each bubble is one problem group: how often it happens and how long each takes.',
  'v2p.pa.scatterAria':
    'Bubble chart of {n} problem groups by how often they happen and how long each one takes.',
  'v2p.pa.headline': '{top} costs the most: {share}.',
  'v2p.pa.noFigures': 'The engine printed no problem figures.',
  'v2p.pa.source':
    'Source: the breakdown log, production machines, PM left out. Records to {date}.',
  'v2p.pa.context': '{label}: {value}. {sub}',
  // Breakdown Log.
  'v2p.page': 'Page {page}',
  'v2p.loading': 'Loading the next page…',
  'v2p.bl.title': 'Breakdown log',
  'v2p.bl.headline': '{count} entries in the breakdown log, newest {date}.',
  'v2p.bl.whole': 'The log holds {count} entries; the filters narrow what is listed.',
  'v2p.bl.source': 'Source: the breakdown log, PM entries included. Records to {date}.',
  'v2p.bl.search': 'Search the log',
  'v2p.bl.srNo': 'Sr No',
  'v2p.bl.ticket': 'Ticket',
  'v2p.bl.hours': 'Downtime (hrs)',
};
