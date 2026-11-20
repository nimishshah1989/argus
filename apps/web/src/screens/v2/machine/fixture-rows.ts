import type { MachineData } from '../../../ui/v2/domain/plant.js';

/**
 * The raw invented rows behind one machine's page: its breakdowns of the last 12 months, its PM visits and its
 * spare stock. Everything the page prints is computed from these, so the figures agree (machine.test checks). The
 * rows are made from the machine's own figures: its month's hours are exactly the plant fixture's, and its
 * breakdowns in 90 days are exactly its `stops`.
 */
export type Who = 'neel-s' | 'arjun-v';
export type RawBreakdown = {
  /** Days before today, 20-Nov-2026. */
  days: number;
  /** Repair hours in tenths of an hour. */
  tenths: number;
  problem: string;
  who: Who;
  /** Tenths of an hour spent waiting for a part. */
  waited: number;
  open: boolean;
};
export type RawPm = { days: number; tenths: number; onTime: boolean };
export type RawMachine = {
  breakdowns: RawBreakdown[];
  pm: RawPm[];
  stock: Record<string, number>;
};

/** What goes wrong on each type of machine, what usually causes it, the fix and the part the fix uses. */
export type Problem = { problem: string; cause: string; fix: string; part: string };
export const PROBLEMS: Record<string, Problem[]> = {
  TC: [
    {
      problem: 'Spindle alarm',
      cause: 'bearing wear',
      fix: 'replaced the bearing set',
      part: 'Spindle bearing set',
    },
    {
      problem: 'Ball screw noise',
      cause: 'dry ball screw',
      fix: 'cleaned and re-greased the screw',
      part: 'Ball screw kit',
    },
    {
      problem: 'Turret not indexing',
      cause: 'dirty sensor',
      fix: 'cleaned the turret sensor',
      part: 'Turret sensor',
    },
    {
      problem: 'Coolant hose leak',
      cause: 'worn hose clamp',
      fix: 'changed the hose and clamps',
      part: 'Coolant hose kit',
    },
  ],
  VC: [
    {
      problem: 'Axis motor fault',
      cause: 'bent motor cable',
      fix: 'replaced the motor cable',
      part: 'Axis motor cable',
    },
    {
      problem: 'Spindle alarm',
      cause: 'drive overload',
      fix: 'reset and re-tuned the drive',
      part: 'Spindle drive card',
    },
    {
      problem: 'Tool clamp stuck',
      cause: 'worn draw bar',
      fix: 'replaced the draw bar springs',
      part: 'Draw bar springs',
    },
    {
      problem: 'ATC arm jam',
      cause: 'misaligned arm',
      fix: 'realigned the arm',
      part: 'ATC arm sensor',
    },
  ],
  VTL: [
    {
      problem: 'Spindle alarm',
      cause: 'low lubrication',
      fix: 'flushed the lubrication line',
      part: 'Lubrication pump',
    },
    {
      problem: 'Table drive fault',
      cause: 'encoder dust',
      fix: 'cleaned the encoder',
      part: 'Table encoder',
    },
    {
      problem: 'Hydraulic leak',
      cause: 'worn seal',
      fix: 'replaced the seal',
      part: 'Hydraulic seal kit',
    },
    {
      problem: 'Coolant hose leak',
      cause: 'worn hose clamp',
      fix: 'changed the hose and clamps',
      part: 'Coolant hose kit',
    },
  ],
  GRD: [
    {
      problem: 'Coolant leakage',
      cause: 'pump seal wear',
      fix: 'replaced the pump seal',
      part: 'Pump seal',
    },
    {
      problem: 'Spindle alarm',
      cause: 'wheel imbalance',
      fix: 'balanced the wheel',
      part: 'Balancing weights',
    },
    {
      problem: 'Wheel spindle noise',
      cause: 'bearing wear',
      fix: 'replaced the wheel bearings',
      part: 'Wheel bearings',
    },
    {
      problem: 'PLC alarm',
      cause: 'loose input wire',
      fix: 'tightened the input terminals',
      part: 'Input module',
    },
  ],
};
export const problemsOf = (code: string): Problem[] =>
  PROBLEMS[code.split('-')[0]!] ?? PROBLEMS.TC!;

/** Today in the gallery, and the days between today and a date. */
const TODAY = Date.UTC(2026, 10, 20);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** `DD-MMM-YYYY` for a day `daysAgo` before today (negative: after). */
export function dateOf(daysAgo: number): { shown: string; iso: string } {
  const d = new Date(TODAY - daysAgo * 86_400_000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return {
    shown: `${dd}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`,
    iso: d.toISOString().slice(0, 10),
  };
}
/** This month, November, is the 20 days up to and including today; October is the 31 days before it. */
export const THIS_MONTH = 19;
export const LAST_MONTH: [number, number] = [20, 50];

/** A small seeded random source, so a machine always gets the same history. */
function seeded(text: string): () => number {
  let a = [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` distinct days between `from` and `to`, one in each equal stretch. */
function spread(next: () => number, from: number, to: number, count: number): number[] {
  if (count <= 0) return [];
  const stride = Math.max(1, Math.floor((to - from + 1) / count));
  return Array.from({ length: count }, (_, j) => from + j * stride + Math.floor(next() * stride));
}

/** `total` tenths shared out over `count` breakdowns; none is empty and they add up exactly. */
function share(next: () => number, total: number, count: number): number[] {
  const w = Array.from({ length: count }, () => 1 + next() * 2);
  const sum = w.reduce((s, x) => s + x, 0);
  const parts = w.map((x) => Math.max(1, Math.floor((total * x) / sum)));
  parts[count - 1] = total - parts.slice(0, -1).reduce((s, x) => s + x, 0);
  return parts;
}

/** How many breakdowns a month with `tenths` of hours is made of. */
const monthCount = (tenths: number, stops: number) =>
  tenths === 0 ? 0 : Math.min(stops, tenths >= 250 ? 4 : tenths >= 100 ? 3 : tenths >= 40 ? 2 : 1);

/** The open breakdown of a machine that is down now: it has been down 2 h 40 min (the plant fixture says so). */
const OPEN_TENTHS = 27;

export function rawMachine(m: MachineData): RawMachine {
  const next = seeded(m.code);
  const list = problemsOf(m.code);
  const pick = () => list[Math.floor(next() ** 2 * list.length)]!.problem;
  const who = (): Who => (next() < 0.5 ? 'neel-s' : 'arjun-v');
  const month = Math.round(m.hours.value * 10);
  const k = monthCount(month, m.stops);
  const down = m.state === 'down';
  const days = [
    ...spread(next, 0, THIS_MONTH, k).map((d, j) => (down && j === 0 ? 0 : d)),
    // A running machine has had no breakdown in 30 days, and a risky one exactly the three its month holds.
    ...spread(next, m.state === 'run' || m.state === 'risk' ? 30 : 20, 89, m.stops - k),
    ...spread(next, 90, 364, 6 + Math.floor(next() * 6)),
  ];
  const tenths = [
    ...(down && k > 0
      ? [OPEN_TENTHS, ...share(next, month - OPEN_TENTHS, k - 1)]
      : share(next, month, k)),
    ...days.slice(k).map(() => 5 + Math.floor(next() * 100)),
  ];
  const breakdowns = days.map((d, i) => {
    const open = down && i === 0;
    const wait = !open && next() < 0.22;
    return {
      days: d,
      tenths: tenths[i]!,
      problem: open ? 'Spindle alarm' : pick(),
      who: open ? ('neel-s' as const) : who(),
      waited: wait ? Math.floor(tenths[i]! * 0.4) : 0,
      open,
    };
  });
  const overdue = [...m.code].reduce((s, c) => s + c.charCodeAt(0), 0) % 7 === 0;
  const last =
    m.state === 'pm' ? 0 : overdue ? 95 + Math.floor(next() * 20) : 6 + Math.floor(next() * 80);
  const pm = [0, 1, 2, 3]
    .map((j) => ({
      days: last + j * 91,
      tenths: 20 + Math.floor(next() * 40),
      onTime: next() < 0.8,
    }))
    .filter((v) => v.days <= 364);
  const stock = Object.fromEntries(list.map((p) => [p.part, Math.floor(next() * 4)]));
  return { breakdowns: breakdowns.sort((a, b) => a.days - b.days), pm, stock };
}
