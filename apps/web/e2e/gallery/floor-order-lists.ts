/**
 * The control order of every floor screen, written out in full ("tag: first 40 letters @third of a 740 px screen").
 * First written from the screens BEFORE the 89a restyle (12-letter names, no third); regenerated on the review's
 * request with 40 letters and the third, from the current screens, which match the old ones control for control.
 * One legitimate change: the mock now answers My complaints by the `raisedBy` person like the real endpoint, so the
 * maintenance login lists its own one complaint instead of the operator's three.
 */
export const BROWSE = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'h2: Report a problem @1',
  'h3: Which machine? @1',
  'input: Find a machine @1',
  'button: CNC-01 @2',
  'button: DRL-04 @2',
  'button: Other work (not a machine)Fan, light, wa @2',
  'button: CNCCNC lathes3 machines @3',
  'button: DRLDrills1 machine @3',
  'button: CMPCompressors1 machine @3',
  'a: Report @2',
  'a: My complaints @2',
];

export const SEARCH = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'h2: Report a problem @1',
  'h3: Which machine? @1',
  'input: Find a machine @1',
  'button: CNC-01CNC lathes \u00b7 Cell 6Running @2',
  'button: CNC-02Needs support. Tap to say it has s @2',
  'button: CNC-03CNC lathes \u00b7 Cell 6Running @3',
  'a: Report @2',
  'a: My complaints @2',
];

export const GROUP = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'button: Groups @1',
  'h2: Report a problem @1',
  'h3: CNC CNC lathes @1',
  'input: Machine ID @1',
  'button: CNC-01CNC lathes \u00b7 Cell 6Running @2',
  'button: CNC-02Needs support. Tap to say it has s @2',
  'button: CNC-03CNC lathes \u00b7 Cell 6Running @3',
  'a: Report @3',
  'a: My complaints @3',
];

export const SITUATION = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'button: Machine @1',
  'h2: Report a problem @1',
  'h3: What is the situation? @2',
  'button: Machine has stoppedDowntime starts the m @2',
  'button: Running, needs supportThe machine can ke @2',
  'a: Report @2',
  'a: My complaints @2',
];

export const SITUATION_SUPPORT = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'button: Machine @1',
  'h2: Report a problem @1',
  'h3: What is the situation now? @2',
  'button: Machine has stoppedChanges BD-A1 to stop @2',
  'button: Still running, needs supportOpens BD-A1. @3',
  'a: Report @2',
  'a: My complaints @2',
];

export const PROBLEM = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'button: Type @1',
  'h2: Report a problem @1',
  'h3: What is wrong? @1',
  'textarea: What is wrong? @2',
  'button: Spindle alarm @2',
  'button: Coolant leak @2',
  'button: Hydraulic pressure low @2',
  'button: Send: machine has stopped @3',
  'a: Report @2',
  'a: My complaints @2',
];

export const SENT = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'h2: Report a problem @1',
  'h3: Sent to maintenance @1',
  'button: Report another machine @2',
  'button: See my complaints and their status @2',
  'a: Report @3',
  'a: My complaints @3',
];

export const OTHER = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'button: Report @1',
  'h2: Report a problem @1',
  'h3: Other work (not a machine) @1',
  'select: Where? @2',
  'input: Or type the place @2',
  'select: Type of work @2',
  'textarea: What is needed? @3',
  'button: Normal @3',
  'button: Urgent @3',
  'button: Send work request @4',
  'a: Report @2',
  'a: My complaints @2',
];

export const MINE = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'h2: My complaints @1',
  'button: Cancel @2',
  'h3: Is it fixed? @3',
  'button: Yes, it is fixed @4',
  'button: Not fixed @4',
  'a: Report @2',
  'a: My complaints @2',
];

export const DISPUTE = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'h2: My complaints @1',
  'button: Cancel @2',
  'h3: Is it fixed? @3',
  'button: Yes, it is fixed @4',
  'button: Not fixed @4',
  'a: Report @4',
  'a: My complaints @4',
  'h2: Not fixed @2',
  'button: Close @2',
  'textarea: What is still wrong? @3',
  'button: Send back to maintenance @4',
  'button: Cancel @4',
];

export const CANCEL = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'h2: My complaints @1',
  'button: Cancel @2',
  'h3: Is it fixed? @3',
  'button: Yes, it is fixed @4',
  'button: Not fixed @4',
  'a: Report @4',
  'a: My complaints @4',
  'h2: Cancel the ticket @3',
  'button: Close @3',
  'textarea: Why cancel? @3',
  'button: Cancel ticket @4',
];

export const PM = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'h2: PM jobs @1',
  'a: CMP-01BookedBD-C1Monthly oil and filter  @1',
  'a: CNC-01In progressBD-C2Quarterly spindle  @2',
  'a: Report @2',
  'a: My complaints @2',
  'a: PM jobs @2',
];

export const PROBLEM_TECH = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'button: Type @1',
  'h2: Report a problem @1',
  'h3: What is wrong? @1',
  'textarea: What is wrong? @2',
  'button: Spindle alarm @2',
  'button: Coolant leak @2',
  'button: Hydraulic pressure low @2',
  'input: I am starting work on it now @3',
  'button: Send: machine has stopped @3',
  'a: Report @2',
  'a: My complaints @2',
  'a: PM jobs @2',
];

export const MINE_TECH = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'h2: My complaints @1',
  'button: Cancel @2',
  'a: Report @2',
  'a: My complaints @2',
  'a: PM jobs @2',
];

export const OTHER_TECH = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @0',
  'button: Report @1',
  'h2: Report a problem @1',
  'h3: Other work (not a machine) @1',
  'select: Where? @2',
  'input: Or type the place @2',
  'select: Type of work @2',
  'textarea: What is needed? @3',
  'button: Normal @3',
  'button: Urgent @3',
  'input: I am starting work on it now @4',
  'button: Send work request @4',
  'a: Report @2',
  'a: My complaints @2',
  'a: PM jobs @2',
];
