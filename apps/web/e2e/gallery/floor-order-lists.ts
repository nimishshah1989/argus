/**
 * The control order of every floor screen, written out in full ("tag: first 40 letters"). First written from the
 * screens BEFORE the 89a restyle (12-letter names); the 40-letter lists were regenerated from the current screens
 * and are also green on the pre-restyle code. The third of the screen is not recorded: it is not stable between
 * this machine and CI's fonts, so it is measured in 89b with both tools in one environment. One legitimate list
 * change: the mock answers My complaints by the `raisedBy` person like the real endpoint, so the maintenance login
 * lists its own one complaint.
 */
export const BROWSE = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'h2: Report a problem',
  'h3: Which machine?',
  'input: Find a machine',
  'button: CNC-01',
  'button: DRL-04',
  'button: Other work (not a machine)Fan, light, wa',
  'button: CNCCNC lathes3 machines',
  'button: DRLDrills1 machine',
  'button: CMPCompressors1 machine',
  'a: Report',
  'a: My complaints',
];

export const SEARCH = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'h2: Report a problem',
  'h3: Which machine?',
  'input: Find a machine',
  'button: CNC-01CNC lathes · Cell 6Running',
  'button: CNC-02Needs support. Tap to say it has s',
  'button: CNC-03CNC lathes · Cell 6Running',
  'a: Report',
  'a: My complaints',
];

export const GROUP = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'button: Groups',
  'h2: Report a problem',
  'h3: CNC CNC lathes',
  'input: Machine ID',
  'button: CNC-01CNC lathes · Cell 6Running',
  'button: CNC-02Needs support. Tap to say it has s',
  'button: CNC-03CNC lathes · Cell 6Running',
  'a: Report',
  'a: My complaints',
];

export const SITUATION = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'button: Machine',
  'h2: Report a problem',
  'h3: What is the situation?',
  'button: Machine has stoppedDowntime starts the m',
  'button: Running, needs supportThe machine can ke',
  'a: Report',
  'a: My complaints',
];

export const SITUATION_SUPPORT = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'button: Machine',
  'h2: Report a problem',
  'h3: What is the situation now?',
  'button: Machine has stoppedChanges BD-A1 to stop',
  'button: Still running, needs supportOpens BD-A1.',
  'a: Report',
  'a: My complaints',
];

export const PROBLEM = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'button: Type',
  'h2: Report a problem',
  'h3: What is wrong?',
  'textarea: What is wrong?',
  'button: Spindle alarm',
  'button: Coolant leak',
  'button: Hydraulic pressure low',
  'button: Send: machine has stopped',
  'a: Report',
  'a: My complaints',
];

export const SENT = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'h2: Report a problem',
  'h3: Sent to maintenance',
  'button: Report another machine',
  'button: See my complaints and their status',
  'a: Report',
  'a: My complaints',
];

export const OTHER = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'button: Report',
  'h2: Report a problem',
  'h3: Other work (not a machine)',
  'select: Where?',
  'input: Or type the place',
  'select: Type of work',
  'textarea: What is needed?',
  'button: Normal',
  'button: Urgent',
  'button: Send work request',
  'a: Report',
  'a: My complaints',
];

export const MINE = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'h2: My complaints',
  'button: Cancel',
  'h3: Is it fixed?',
  'button: Yes, it is fixed',
  'button: Not fixed',
  'a: Report',
  'a: My complaints',
];

export const DISPUTE = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'h2: My complaints',
  'button: Cancel',
  'h3: Is it fixed?',
  'button: Yes, it is fixed',
  'button: Not fixed',
  'a: Report',
  'a: My complaints',
  'h2: Not fixed',
  'button: Close',
  'textarea: What is still wrong?',
  'button: Send back to maintenance',
  'button: Cancel',
];

export const CANCEL = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'h2: My complaints',
  'button: Cancel',
  'h3: Is it fixed?',
  'button: Yes, it is fixed',
  'button: Not fixed',
  'a: Report',
  'a: My complaints',
  'h2: Cancel the ticket',
  'button: Close',
  'textarea: Why cancel?',
  'button: Cancel ticket',
];

export const PM = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'h2: PM jobs',
  'a: CMP-01BookedBD-C1Monthly oil and filter ',
  'a: CNC-01In progressBD-C2Quarterly spindle ',
  'a: Report',
  'a: My complaints',
  'a: PM jobs',
];

export const PROBLEM_TECH = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'button: Type',
  'h2: Report a problem',
  'h3: What is wrong?',
  'textarea: What is wrong?',
  'button: Spindle alarm',
  'button: Coolant leak',
  'button: Hydraulic pressure low',
  'input: I am starting work on it now',
  'button: Send: machine has stopped',
  'a: Report',
  'a: My complaints',
  'a: PM jobs',
];

export const MINE_TECH = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'h2: My complaints',
  'button: Cancel',
  'a: Report',
  'a: My complaints',
  'a: PM jobs',
];

export const OTHER_TECH = [
  'button: Account',
  'h2: Needs attention',
  'button: Dismiss',
  'button: Report',
  'h2: Report a problem',
  'h3: Other work (not a machine)',
  'select: Where?',
  'input: Or type the place',
  'select: Type of work',
  'textarea: What is needed?',
  'button: Normal',
  'button: Urgent',
  'input: I am starting work on it now',
  'button: Send work request',
  'a: Report',
  'a: My complaints',
  'a: PM jobs',
];
