/**
 * The words of the v2 Reliability screens (BD % and PM split, Category and cell, MTTR and MTBF, Manpower, Why-Why)
 * that are not the engine's own printed text. `{name}` is filled by the screen (`fill`), not by i18next. Gujarati is a
 * blank placeholder until the translation sweep; there is no Hindi catalogue yet.
 */
export const analyticsV2ReliabilityEn = {
  // Shared by every printed page.
  'v2r.noFigures': 'The engine printed no figures for this page.',
  'v2r.cell': 'Cell {n}',
  'v2r.search': 'Search this table',
  'v2r.chart.sub': '{series} by {axis}',
  'v2r.chart.aria': '{title}. {series}, {n} points by {axis}.',
  'v2r.pair.title': '{title} · {measure}',
  'v2r.pair.count': '# Breakdowns',
  'v2r.pair.jobs': '# PM jobs',
  'v2r.pair.hours': 'PM hours',
  // BD % and PM split.
  'v2r.bd.title': 'BD % and PM split',
  'v2r.bd.source':
    'Source: breakdown and PM entries of the production machines, against their available hours. Records to {date}.',
  'v2r.bd.headline':
    'Breakdowns took {bd} ({bdSub}) and PM took {pm} ({pmSub}). Fleet availability is {availability}.',
  'v2r.bd.availability': 'Availability: {sub}.',
  'v2r.bd.worst':
    '{cell} loses the most: {total} of its available hours (breakdowns {bd}, PM {pm}).',
  // Category and cell.
  'v2r.cc.title': 'Category and cell',
  'v2r.cc.source':
    'Source: the breakdown log, production machines, PM left out. Records to {date}.',
  'v2r.cc.headline': '{name} has the most breakdown hours: {hours} hrs, {share} of the total.',
  'v2r.cc.cell':
    '{cell} has the most breakdown hours of any cell: {hours} hrs, {share} of the total.',
  'v2r.cc.perMachine': '{name} loses the most per machine: {hours} hrs each.',
  // MTTR and MTBF.
  'v2r.mm.title': 'MTTR and MTBF',
  'v2r.mm.source':
    'Source: the breakdown log, production machines, PM left out. Records to {date}.',
  'v2r.mm.headline':
    'A breakdown takes {mttr} hrs to fix on average, and a machine runs {mtbf} hrs between breakdowns.',
  'v2r.mm.slowest':
    '{cell} is the slowest to fix: {mttr} hrs a breakdown, with {mtbf} hrs between breakdowns.',
  // Manpower.
  'v2r.mp.title': 'Manpower',
  'v2r.mp.source':
    'Source: the breakdown reports and the people who did them, PM kept apart. Records to {date}.',
  'v2r.mp.headline': '{person} handled the most breakdowns: {count} of {total} ({share}).',
  'v2r.mp.hours': '{person} put in the most hours on breakdowns: {hours} hrs.',
  'v2r.mp.team': '{n} team members tracked ({sub}), {hours} breakdown hours in all.',
  // Why-Why.
  'v2r.ww.title': 'Why-Why',
  'v2r.ww.source':
    'Source: closed breakdowns over the Why-Why limit set in Settings. Records to {date}.',
  'v2r.ww.tableTitle': 'Breakdowns that ran past the Why-Why limit',
  'v2r.ww.headline':
    '{n} breakdowns ran past the Why-Why limit: {done} have a Why-Why, {todo} are waiting.',
  'v2r.ww.worst': 'The longest was {machine} on {date}, {hours} hrs down. {problem}',
  'v2r.ww.down': 'Down (hrs)',
  'v2r.ww.status': 'Status',
  'v2r.ww.todo': 'Not started',
  'v2r.ww.done': 'Completed',
};
