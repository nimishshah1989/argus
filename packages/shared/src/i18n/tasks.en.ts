/**
 * Follow-up tasks (ticket 19, `v3.actions.17` and `v3.reporting.05`): the box on the parent breakdown, the
 * Tasks tab, leaving a task at close, the minutes asked when a task is done, and the floor's warning. Its own
 * namespace, so three parallel screen streams never edit the same catalogue file.
 */
export const tasksEn = {
  'tasks.title': 'Follow-up tasks',
  'tasks.thisTask': 'Follow-up task',
  'tasks.summary':
    '{{pending}} pending · {{inProgress}} in progress · {{overdue}} overdue · {{done}} done',
  'tasks.none': 'No follow-up tasks.',
  'tasks.reason': 'Reason',
  'tasks.expectedOn': 'Expected',
  'tasks.expected': 'expected {{date}}',
  'tasks.left': 'Left from {{ref}}',
  'tasks.leftBy': 'Left by {{who}}',
  'tasks.downMin': '{{minutes}} machine-stopped',
  'tasks.finishedBy': 'Done by {{who}}',
  'tasks.tabHint': 'Follow-up tasks left after a close, earliest expected date first.',
  'tasks.tabEmpty': 'No follow-up tasks.',
  'tasks.leave': 'Leave a follow-up task',
  'tasks.leaveHint':
    'The job is not finished. It becomes a task on this breakdown, with a reason and an expected date.',
  'tasks.what': 'What is left',
  'tasks.expectedLabel': 'Expected date',
  'tasks.expectedHint': 'Optional. A task with no date never turns overdue.',
  'tasks.stoppedMinutes': 'Machine-stopped minutes',
  'tasks.stoppedMinutesHint':
    '0 to 1440. It stays on this task and is not added to the breakdown downtime.',
  'tasks.warningTitle': 'This machine has a follow-up task',
  'tasks.warningBody': '{{ref}} · {{reason}} · expected {{date}}',
  'tasks.warningBodyNoDate': '{{ref}} · {{reason}}',
};
