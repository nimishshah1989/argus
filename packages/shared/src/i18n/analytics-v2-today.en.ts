/**
 * The v2 Today section and the machine page (go-live of the Dashboard, the Action Center and the Machine page): only
 * the sentences the v2 screens add. Every word v1 already had (figure names, nudge types, nameplate facts) keeps its
 * `analytics.` key, so one phrase is never translated twice. `{name}` gaps are filled by the screen.
 */
export const analyticsV2TodayEn = {
  'v2t.ac.why1':
    'A nudge is a rule firing on the breakdown log, the PM entries, the machines or the team. High, medium and low ask a person to act; good news only tells you.',
  'v2t.ac.why2':
    'A machine scores 3 for each high, 2 for each medium and 1 for each low nudge open on it.',
  'v2t.ac.nudges': 'Nudges',
  'v2t.dash.headline':
    'Fleet availability is {availability}. {breakdowns} breakdowns have cost {hours}, and {problem} costs the most.',
  'v2t.dash.headlineFew': 'The plant as of {date}: some of the figures are not computed yet.',
  'v2t.dash.why1':
    "These are the engine's own figures for the whole log to date; a change is against the same figure 30 days earlier.",
  'v2t.dash.why2':
    "Fleet availability counts breakdown, PM and plant-event hours as lost, against the production fleet's available hours.",
  'v2t.dash.vs': 'vs {{date}}',
  'v2t.dash.others': 'All other problems',
  'v2t.dash.costliestWhy':
    'The three problems that cost the most downtime, and everything else together.',
  'v2t.dash.bubbleSub':
    'Each bubble is a machine: its downtime hours, its breakdowns, sized by repair time.',
  'v2t.dash.bubbleAria':
    'A bubble for every machine: downtime hours across, breakdowns up, repair time as size.',
  'v2t.dash.timelineSub': 'Machines added each year by type, and the fleet size to date.',
  'v2t.dash.timelineAria':
    'Machines added each year as stacked bars, with the cumulative fleet size as a line.',
  'v2t.dash.share': 'Share of breakdown hours',
  'v2t.mp.headline':
    '{code} has had {count} breakdowns costing {hours}, and a repair takes {mttr} on average.',
  'v2t.mp.headlineNone': '{code} has no breakdown figures yet.',
  'v2t.mp.why1':
    "These are the engine's own figures for this machine over its whole history, as of the day shown.",
  'v2t.mp.why2':
    'The reliability fit counts working hours between failures; with too few failures it borrows the machine type.',
};
