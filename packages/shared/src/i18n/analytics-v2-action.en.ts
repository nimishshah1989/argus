/**
 * The v2 Action Center (ticket 91): the words the rebuilt screen adds to v1's own `analytics.actionCenter.*` keys, which
 * it reuses wherever v1 had a word. `{name}` gaps are filled by the screen; `{{name}}` by i18next.
 */
export const analyticsV2ActionEn = {
  'v2a.table.title': 'Nudges',
  'v2a.col.priority': 'Priority',
  'v2a.col.nudge': 'Nudge',
  'v2a.col.entries': 'Entries',
  'v2a.col.latest': 'Latest entry',
  'v2a.col.status': 'Status',
  'v2a.kpi.none': 'Nothing open',
  'v2a.kpi.low': 'Keep an eye on these',
  'v2a.kpi.info': 'Good news, nothing to do',
  'v2a.kpi.more':
    'Counts open nudges only. Acknowledged, snoozed and resolved ones are in their own tabs below.',
  'v2a.verdict.calm': '{n} nudges are open, none of them urgent.',
  'v2a.why.top': ' ranks first for attention, with a score of {score}: {why}.',
  'v2a.why.scope':
    'Each nudge is worked out from the breakdown log, PM entries, machines and team against the plant’s own limits. Acknowledged, snoozed and resolved nudges leave the counts above.',
  'v2a.detail.about': 'What stands behind it',
  'v2a.detail.stored': 'What was recorded',
  'v2a.detail.actions': 'What to do',
  'v2a.detail.machines': 'Machines',
  'v2a.owner.none': 'No owner set',
  'v2a.saved': 'Could not refresh. Showing the last answer.',
};
