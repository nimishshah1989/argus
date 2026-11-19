/**
 * The control order of every floor screen, written out in full ("tag: first 40 letters @third"). The third is the
 * third of a 740 px screen the control's centre falls in, "fold" below the first screen, or "edge" within 32 px of a boundary (CI's fonts move
 * heights a few pixels). First written from the screens BEFORE the 89a restyle; regenerated from the current ones,
 * which match the old ones control for control. One legitimate change: the mock answers My complaints by the
 * `raisedBy` person like the real endpoint, so the maintenance login lists its own one complaint.
 */
export const BROWSE = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'h2: Report a problem @1',
  'h3: Which machine? @1',
  'input: Find a machine @edge',
  'button: CNC-01 @2',
  'button: DRL-04 @2',
  'button: Other work (not a machine)Fan, light, wa @2',
  'button: CNCCNC lathes3 machines @fold',
  'button: DRLDrills1 machine @fold',
  'button: CMPCompressors1 machine @fold',
  'a: Report @edge',
  'a: My complaints @edge',
];

export const SEARCH = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'h2: Report a problem @1',
  'h3: Which machine? @1',
  'input: Find a machine @edge',
  'button: CNC-01CNC lathes · Cell 6Running @2',
  'button: CNC-02Needs support. Tap to say it has s @2',
  'button: CNC-03CNC lathes · Cell 6Running @fold',
  'a: Report @edge',
  'a: My complaints @edge',
];

export const GROUP = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'button: Groups @1',
  'h2: Report a problem @1',
  'h3: CNC CNC lathes @1',
  'input: Machine ID @edge',
  'button: CNC-01CNC lathes · Cell 6Running @2',
  'button: CNC-02Needs support. Tap to say it has s @edge',
  'button: CNC-03CNC lathes · Cell 6Running @fold',
  'a: Report @fold',
  'a: My complaints @fold',
];

export const SITUATION = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'button: Machine @1',
  'h2: Report a problem @1',
  'h3: What is the situation? @2',
  'button: Machine has stoppedDowntime starts the m @2',
  'button: Running, needs supportThe machine can ke @fold',
  'a: Report @edge',
  'a: My complaints @edge',
];

export const SITUATION_SUPPORT = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'button: Machine @1',
  'h2: Report a problem @1',
  'h3: What is the situation now? @2',
  'button: Machine has stoppedChanges BD-A1 to stop @fold',
  'button: Still running, needs supportOpens BD-A1. @fold',
  'a: Report @edge',
  'a: My complaints @edge',
];

export const PROBLEM = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'button: Type @1',
  'h2: Report a problem @1',
  'h3: What is wrong? @edge',
  'textarea: What is wrong? @2',
  'button: Spindle alarm @2',
  'button: Coolant leak @2',
  'button: Hydraulic pressure low @edge',
  'button: Send: machine has stopped @fold',
  'a: Report @edge',
  'a: My complaints @edge',
];

export const SENT = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'h2: Report a problem @1',
  'h3: Sent to maintenance @1',
  'button: Report another machine @2',
  'button: See my complaints and their status @edge',
  'a: Report @fold',
  'a: My complaints @fold',
];

export const OTHER = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'button: Report @1',
  'h2: Report a problem @1',
  'h3: Other work (not a machine) @1',
  'select: Where? @2',
  'input: Or type the place @2',
  'select: Type of work @fold',
  'textarea: What is needed? @fold',
  'button: Normal @fold',
  'button: Urgent @fold',
  'button: Send work request @fold',
  'a: Report @edge',
  'a: My complaints @edge',
];

export const MINE = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'h2: My complaints @1',
  'button: Cancel @2',
  'h3: Is it fixed? @fold',
  'button: Yes, it is fixed @fold',
  'button: Not fixed @fold',
  'a: Report @edge',
  'a: My complaints @edge',
];

export const DISPUTE = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'h2: My complaints @1',
  'button: Cancel @2',
  'h3: Is it fixed? @fold',
  'button: Yes, it is fixed @fold',
  'button: Not fixed @fold',
  'a: Report @fold',
  'a: My complaints @fold',
  'h2: Not fixed @edge',
  'button: Close @edge',
  'textarea: What is still wrong? @fold',
  'button: Send back to maintenance @fold',
  'button: Cancel @fold',
];

export const CANCEL = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'h2: My complaints @1',
  'button: Cancel @2',
  'h3: Is it fixed? @fold',
  'button: Yes, it is fixed @fold',
  'button: Not fixed @fold',
  'a: Report @fold',
  'a: My complaints @fold',
  'h2: Cancel the ticket @fold',
  'button: Close @fold',
  'textarea: Why cancel? @fold',
  'button: Cancel ticket @fold',
];

export const PM = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'h2: PM jobs @1',
  'a: CMP-01BookedBD-C1Monthly oil and filter  @1',
  'a: CNC-01In progressBD-C2Quarterly spindle  @2',
  'a: Report @edge',
  'a: My complaints @edge',
  'a: PM jobs @edge',
];

export const PROBLEM_TECH = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'button: Type @1',
  'h2: Report a problem @1',
  'h3: What is wrong? @edge',
  'textarea: What is wrong? @2',
  'button: Spindle alarm @2',
  'button: Coolant leak @2',
  'button: Hydraulic pressure low @edge',
  'input: I am starting work on it now @fold',
  'button: Send: machine has stopped @fold',
  'a: Report @edge',
  'a: My complaints @edge',
  'a: PM jobs @edge',
];

export const MINE_TECH = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'h2: My complaints @1',
  'button: Cancel @2',
  'a: Report @edge',
  'a: My complaints @edge',
  'a: PM jobs @edge',
];

export const OTHER_TECH = [
  'button: Account @0',
  'h2: Needs attention @0',
  'button: Dismiss @edge',
  'button: Report @1',
  'h2: Report a problem @1',
  'h3: Other work (not a machine) @1',
  'select: Where? @2',
  'input: Or type the place @2',
  'select: Type of work @fold',
  'textarea: What is needed? @fold',
  'button: Normal @fold',
  'button: Urgent @fold',
  'input: I am starting work on it now @fold',
  'button: Send work request @fold',
  'a: Report @edge',
  'a: My complaints @edge',
  'a: PM jobs @edge',
];
