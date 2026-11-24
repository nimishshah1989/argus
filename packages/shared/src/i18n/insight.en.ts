/** Insight lines (ADR 0023): the tone words and the generic outlier sentence every v2 screen's takeaways build on. */
export const insightEn = {
  'insight.tag.loss': 'Loss',
  'insight.tag.risk': 'Risk',
  'insight.tag.gain': 'Gain',
  'insight.tag.neutral': 'Note',
  'insight.outlier': '{name} is {n}× the average of the others ({value}).',
  'insight.none': 'Nothing stands out here.',
  'insight.target.all': 'All {total} meet {target}.',
  'insight.target.none': 'None of the {total} meet {target}.',
  'insight.target.only': 'Only {name} meets {target}.',
  'insight.target.miss': '{k} of {total} miss {target}; worst is {name} ({value}).',
  'insight.concentration': '{k} of {n} make up {pct}% of the total.',
  'insight.change': '{delta} on {period}.',
  'insight.change.flat': 'No change on {period}.',
  'insight.fold.more': '+ {n} more',
  'insight.fold.within': '+ {n} more, all within target',
  'insight.expand': 'Show detail: {name}',
  // ADR 0035: a tile's yardstick in kit words, so screen tickets never edit a shared catalogue.
  'insight.yardstick.rank': '{rank} of {n}, highest first',
  'insight.yardstick.share': '{pct}% of {total}',
  'insight.yardstick.average': 'Average {value}',
  'insight.yardstick.target': 'Target {value}',
  'insight.yardstick.prior': '{period}: {value}',
  // ADR 0036: the status word beside its colour (colour never works alone), the period a page states, a set of tiles
  // that are all zero, and the note on a page Gujarati cannot cover.
  'insight.status.good': 'On target',
  'insight.status.watch': 'Watch',
  'insight.status.bad': 'Off target',
  'insight.period.year': 'This year, 1 Jan to {date}',
  'insight.period.all': 'History and live, {from} to {date}',
  'insight.tiles.allZero': 'All {n} are zero: {labels}.',
  'insight.language.guIncomplete':
    'Gujarati is not complete for this page, so it is shown in English.',
};
