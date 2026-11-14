/** Ticket 66, lockout before electrical work (slice 7). Step labels come from the plant's list, not from here. */
export const lockoutEn = {
  'lockout.chip': 'Needs lockout',
  'lockout.title': 'Lockout before you start',
  'lockout.intro': 'This job needs lockout. Tick each step when it is done.',
  'lockout.progress': 'This job needs lockout. {{done}} of {{total}} done.',
  'lockout.tickAll': 'Tick all {{count}} steps to start.',
  'lockout.confirming': 'Confirming and starting...',
  'lockout.refusedTitle': 'Start refused',
  'lockout.refused': 'The lockout steps were not confirmed. Tick every step, then start again.',
  'lockout.stepsChanged': 'The lockout steps have changed. Tick the new list, then start again.',
  'lockout.noSteps': 'This plant has no lockout steps yet. Ask the maintenance head.',
  'lockout.offline':
    'No connection. The lockout is confirmed online: try again when you are connected.',
  'lockout.confirmedTitle': 'Lockout confirmed',
  'lockout.confirmedBy': 'By {{name}} at {{time}}. All {{count}} steps were done. You can start.',
  'lockout.confirmedByYou':
    'By {{name}} (you) at {{time}}. All {{count}} steps were done. You can start.',
  'lockout.recordTitle': 'Confirm before touching the machine',
  'lockout.record': 'Nobody has confirmed the lockout steps since this job came back to work.',
  'lockout.noStepsTitle': 'No lockout steps',
  'timeline.lockoutConfirmed': 'Lockout confirmed',
};
