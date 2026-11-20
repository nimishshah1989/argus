import { machineChip, type MachineData } from '../../../ui/v2/domain/plant.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import { dashboardFixture } from '../dashboard/fixture.js';
import { PEOPLE, type PersonId } from './fixture-people.js';
import type { RecordRow } from './model.js';

/** The invented checks of the gallery's data. Everything the screen prints is worked out from these rows. */
export const person = (id: PersonId): EntityChipProps => ({
  kind: 'person',
  id,
  label: PEOPLE[id],
});

export const MACHINES = dashboardFixture.cells.flatMap((c) => c.machines);
const where = (state: MachineData['state']) => MACHINES.filter((m) => m.state === state);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TODAY = Date.UTC(2026, 10, 20);
/** A date as DD-MMM-YYYY, a number of days before 20-Nov-2026. */
export const daysAgo = (n: number) => {
  const d = new Date(TODAY - n * 86_400_000);
  return `${String(d.getUTCDate()).padStart(2, '0')}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};

export type Area = 'machines' | 'log' | 'pm' | 'people';
export const AREAS: Record<Area, { label: string; owner: PersonId }> = {
  machines: { label: 'Machine records', owner: 'neel-s' },
  log: { label: 'Breakdown log', owner: 'meera-k' },
  pm: { label: 'PM', owner: 'arjun-v' },
  people: { label: 'People', owner: 'meera-k' },
};

export type Check = {
  id: string;
  area: Area;
  status: 'ready' | 'check' | 'gap';
  title: string;
  /** For a passing check, the sentence under "Already trusted". */
  passes?: string;
  impact: string;
  fix: string;
  why: string[];
  /** What is wrong with each record, and how many days it has been open. */
  wrong: string;
  ages: number[];
  machines: MachineData[];
};

const idle = where('idle');
const run = where('run');
const stopped = [...where('down'), ...where('risk')];
const pm = where('pm');

/** Twelve checks: seven pass, two are worth a look, three are gaps that change a figure on screen. */
export const CHECKS: Check[] = [
  {
    id: 'm1',
    area: 'machines',
    status: 'gap',
    title: 'Purchase date missing',
    impact: 'Changes average age',
    fix: 'Add the dates',
    why: [
      'Age shows **—** for these machines, so the age analysis leaves them out',
      'Add the date from the invoice and **Age** fills in',
    ],
    wrong: 'No purchase date',
    ages: [33, 21, 14, 9],
    machines: [3, 30, 57, 84].map((i) => run[i]!),
  },
  {
    id: 'm3',
    area: 'machines',
    status: 'check',
    title: 'Marked "not in production data"',
    impact: 'Left out on purpose',
    fix: 'Review in Settings',
    why: [
      'It does not count in breakdown share, time to repair or time between failures',
      'Change it in **Settings** if that is wrong',
    ],
    wrong: 'Marked "not in production data"',
    ages: [60],
    machines: [idle[0]!],
  },
  {
    id: 'm2',
    area: 'machines',
    status: 'ready',
    title: 'Every machine has a cell',
    passes: `Every machine has a cell · **${MACHINES.length} of ${MACHINES.length}**`,
    impact: '',
    fix: '',
    why: [],
    wrong: '',
    ages: [],
    machines: [],
  },
  {
    id: 'm4',
    area: 'machines',
    status: 'ready',
    title: 'Every machine has a type',
    passes: `Every machine has a type, so its colour and its peers are right · **${MACHINES.length} of ${MACHINES.length}**`,
    impact: '',
    fix: '',
    why: [],
    wrong: '',
    ages: [],
    machines: [],
  },
  {
    id: 'b1',
    area: 'log',
    status: 'gap',
    title: 'Breakdowns without a problem code',
    impact: 'Changes where the hours go',
    fix: 'Code them now',
    why: [
      'These breakdowns fall into ~~Other~~ in "Where the hours go"',
      'A code takes about **2 minutes** to add and moves the hours to the right bar',
    ],
    wrong: 'Breakdown has no problem code',
    ages: [34, 29, 26, 22, 19, 15, 12, 11, 8, 6, 5, 3],
    machines: stopped.slice(0, 12),
  },
  {
    id: 'b2',
    area: 'log',
    status: 'gap',
    title: 'Breakdowns without an end time',
    impact: 'Changes time to repair',
    fix: 'Close them',
    why: [
      'Time to repair leaves them out until they are closed',
      'They may already be fixed: the end time was never entered',
    ],
    wrong: 'Breakdown has no end time',
    ages: [37, 22, 9],
    machines: [stopped[0]!, stopped[5]!, stopped[9]!],
  },
  {
    id: 'b3',
    area: 'log',
    status: 'ready',
    title: 'Downtime on every closed breakdown',
    passes: 'Downtime is recorded on every closed breakdown, from the log or minutes ÷ 60',
    impact: '',
    fix: '',
    why: [],
    wrong: '',
    ages: [],
    machines: [],
  },
  {
    id: 'b4',
    area: 'log',
    status: 'ready',
    title: 'Every breakdown names a machine',
    passes: 'Every breakdown names a machine, so every hour lands on a machine',
    impact: '',
    fix: '',
    why: [],
    wrong: '',
    ages: [],
    machines: [],
  },
  {
    id: 'p2',
    area: 'pm',
    status: 'check',
    title: 'PM visits without readings',
    impact: 'Changes nothing yet',
    fix: 'Add readings',
    why: ['The PM still counts as done', 'Readings help forecast wear; nothing else changes'],
    wrong: 'PM visit has no readings',
    ages: [11, 4],
    machines: pm.slice(0, 2),
  },
  {
    id: 'p1',
    area: 'pm',
    status: 'ready',
    title: 'Every machine has a PM plan',
    passes: `Every machine has a PM plan · **${MACHINES.length} of ${MACHINES.length}**`,
    impact: '',
    fix: '',
    why: [],
    wrong: '',
    ages: [],
    machines: [],
  },
  {
    id: 'p3',
    area: 'pm',
    status: 'ready',
    title: 'Every PM has a due date',
    passes: 'Every PM has a due date, so overdue PMs are counted',
    impact: '',
    fix: '',
    why: [],
    wrong: '',
    ages: [],
    machines: [],
  },
  {
    id: 'h1',
    area: 'people',
    status: 'ready',
    title: 'Every technician has a shift',
    passes:
      'Every technician has a shift, so manpower hours split by shift correctly · **18 of 18**',
    impact: '',
    fix: '',
    why: [],
    wrong: '',
    ages: [],
    machines: [],
  },
];

/** The records behind one failing check, oldest first. */
export const recordsOf = (c: Check): RecordRow[] =>
  c.machines
    .map((m, i) => ({
      id: `${c.id}-${m.code}-${i}`,
      entity: machineChip(m),
      what: c.wrong,
      area: { key: c.area, label: AREAS[c.area].label },
      owner: person(AREAS[c.area].owner),
      open: { shown: `${c.ages[i]} days · since ${daysAgo(c.ages[i]!)}`, value: c.ages[i]! },
    }))
    .sort((a, b) => b.open.value - a.open.value);
