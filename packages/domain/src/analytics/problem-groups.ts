import type { ReportRow } from './types.js';

/**
 * The platform's own default problem groups (Guide section "Problem Analysis"): the words a breakdown is grouped
 * by, in the order the platform tests them, and the family each group belongs to. The plant may override these in
 * Settings; 38.2 only needs the default list to rank the three problems costing the most downtime, and ticket 41
 * owns the screen that edits them.
 */
export interface ProblemGroup {
  readonly name: string;
  /** The platform's family for the group: its "families of problems" table groups the names this way. */
  readonly family: string;
  readonly keywords: readonly string[];
}

export const PROBLEM_GROUPS: readonly ProblemGroup[] = [
  {
    name: 'Machine accident / crash',
    family: 'Crashes and setup',
    keywords: ['accid', 'acceid', 'crash', 'collision'],
  },
  { name: 'PM logged as a breakdown', family: 'Other', keywords: ['pm'] },
  {
    name: 'Tool-change arm stuck (ATC)',
    family: 'Tool changing',
    keywords: [
      'arm stuck',
      'arm stucked',
      'atc arm',
      'arm not',
      'arm motor',
      'arm position',
      'arm proximity',
      'atc',
    ],
  },
  {
    name: 'Magazine / tool pot',
    family: 'Tool changing',
    keywords: ['magazin', 'tool pot', 'pot not', 'tool fell', 'tool full', 'tool pocket'],
  },
  {
    name: 'Tool clamp / unclamp / drawbar',
    family: 'Tool changing',
    keywords: [
      'tool clamp',
      'tool unclamp',
      'tool un-clamp',
      'tool declamp',
      'tool release',
      'drawbar',
      'draw bar',
      'draw tube',
    ],
  },
  {
    name: 'Tool-change error (general)',
    family: 'Tool changing',
    keywords: ['tool change', 'toolchange', 'tool chang'],
  },
  {
    name: '4th axis / rotary / angular head',
    family: 'Rotary and 4th axis',
    keywords: ['4th', 'fourth', 'rotary', 'angular head', 'tilting'],
  },
  {
    name: 'Axis motor / drive / encoder / servo',
    family: 'Axis, drive and geometry',
    keywords: [
      'fssb',
      'servo',
      'encoder',
      'drive',
      'amplifier',
      'axis motor',
      'overcurrent',
      'over current',
      'power module',
      'x axis',
      'x-axis',
      'y axis',
      'y-axis',
      'z axis',
      'z-axis',
      'axis not',
      'axis jam',
      'axis alarm',
      'axis hum',
      'sv0',
    ],
  },
  {
    name: 'Home position / geometry / backlash',
    family: 'Axis, drive and geometry',
    keywords: [
      'home position',
      'reference',
      'geometr',
      'geomatr',
      'backlash',
      'centre',
      'center',
      'taper',
      'teppar',
      'tapper',
    ],
  },
  {
    name: 'Coolant leakage',
    family: 'Fluids and chips',
    keywords: [
      'coolant leak',
      'coolant lek',
      'colant',
      'coolnat',
      'nozzle leak',
      'water leak',
      'kmt',
      'pump leak',
      'oil leak',
      'coolant pipe',
      'coolant hose',
    ],
  },
  { name: 'Coolant pressure / flow', family: 'Fluids and chips', keywords: ['coolant', 'cts'] },
  {
    name: 'Air leakage / low air pressure',
    family: 'Fluids and chips',
    keywords: ['air', 'pneumat'],
  },
  {
    name: 'Conveyor / chip jam',
    family: 'Fluids and chips',
    keywords: ['conv', 'chain', 'scrap', 'chip'],
  },
  {
    name: 'Spindle motor / overload / noise',
    family: 'Spindle, turret and chuck',
    keywords: ['spindle', '1001'],
  },
  {
    name: 'Turret clamp / indexing',
    family: 'Spindle, turret and chuck',
    keywords: ['turret', 'index'],
  },
  {
    name: 'Chuck / jaw / collet',
    family: 'Spindle, turret and chuck',
    keywords: ['chuck', 'collet', 'jaw', 'tailstock', 'tail stock'],
  },
  {
    name: 'Lubrication / low oil',
    family: 'Fluids and chips',
    keywords: ['lubric', 'lube', 'grease', 'oil'],
  },
  { name: 'Hydraulic pressure', family: 'Fluids and chips', keywords: ['hydraul', 'hyd'] },
  {
    name: 'Door / guard / limit switch / sensor',
    family: 'Electrical and controls',
    keywords: ['door', 'guard', 'limit', 'prox', 'sensor', 'interlock'],
  },
  {
    name: 'Push button / switch / cable / panel',
    family: 'Electrical and controls',
    keywords: [
      'push button',
      'pushbutton',
      'switch',
      'cable',
      'lamp',
      'light',
      'fuse',
      'mcb',
      'panel',
      'display',
      'mpg',
      'connector',
    ],
  },
  {
    name: 'Fan / filter / overheating',
    family: 'Electrical and controls',
    keywords: ['fan', 'fen', 'filter', 'overheat', 'temperature', 'dust'],
  },
  {
    name: 'Alarm / PLC / parameter / reset',
    family: 'Electrical and controls',
    keywords: ['alarm', 'alram', 'parameter', 'plc', 'reset', 'program', 'communication', 'error'],
  },
  {
    name: 'Installation / relocation / trial',
    family: 'Other',
    keywords: ['install', 'resift', 'shift', 'relocat', 'trial'],
  },
  {
    name: 'Belt / bearing / coupling / wear',
    family: 'Mechanical wear',
    keywords: [
      'belt',
      'bearing',
      'coupling',
      'gear',
      'pulley',
      'pully',
      'bush',
      'vibration',
      'noise',
      'noice',
      'broken',
      'loose',
    ],
  },
];

export const OTHER_PROBLEM = 'Other / unclear';

interface CompiledGroup {
  readonly name: string;
  readonly tests: readonly RegExp[];
}

/** A one-to-three letter keyword matches a whole word (so "pm" does not match "pump"); longer ones match anywhere. */
function compile(group: ProblemGroup): CompiledGroup {
  return {
    name: group.name,
    tests: group.keywords.map((keyword) => {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return /^[a-z0-9]{1,3}$/.test(keyword) ? new RegExp(`\\b${escaped}\\b`) : new RegExp(escaped);
    }),
  };
}

const COMPILED = PROBLEM_GROUPS.map(compile);

function firstMatch(text: string): string | null {
  for (const group of COMPILED) if (group.tests.some((test) => test.test(text))) return group.name;
  return null;
}

/**
 * The group a breakdown belongs to: a manual fix wins, then the problem text, then the problem and corrective
 * action together (the platform's own two passes). Unknown text is "Other / unclear".
 */
export function problemGroupOf(
  report: ReportRow,
  fixes: Readonly<Record<string, string>> = {},
): string {
  const fixed = fixes[report.id];
  if (fixed !== undefined && COMPILED.some((group) => group.name === fixed)) return fixed;
  const problem = report.problem.toLowerCase();
  return (
    firstMatch(problem) ??
    firstMatch(`${problem} ${(report.correctiveAction ?? '').toLowerCase()}`) ??
    OTHER_PROBLEM
  );
}
