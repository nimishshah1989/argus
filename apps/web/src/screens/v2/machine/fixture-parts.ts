import type { MachineData } from '../../../ui/v2/domain/plant.js';
import type { Point } from '../../../ui/v2/points.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import { glue, pt, pts } from '../dashboard/fixture-text.js';
import { problemsOf, type RawMachine } from './fixture-rows.js';
import type { NextAction } from './model.js';

/** What the rows say about this machine, worked out once and read by the verdict, the next action and the cards. */
export type Facts = {
  /** Days a PM is overdue; 0 when it is not. */
  overdueDays: number;
  nextPm: string;
  /** The problem it has most often in 12 months, and how many times. */
  top: { problem: string; times: number };
  /** Breakdowns in the last 30 days. */
  last30: number;
  /** The part for the open breakdown, and how many are in stock; null when nothing is open. */
  openPart: { part: string; stock: number } | null;
};

export function factsOf(m: MachineData, raw: RawMachine, nextPm: string): Facts {
  const count = new Map<string, number>();
  for (const b of raw.breakdowns) count.set(b.problem, (count.get(b.problem) ?? 0) + 1);
  const [problem, times] = [...count].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
  const last = raw.pm[0]?.days ?? 0;
  const open = raw.breakdowns.find((b) => b.open);
  const part = open && problemsOf(m.code).find((p) => p.problem === open.problem)?.part;
  return {
    overdueDays: Math.max(0, last - 91),
    nextPm,
    top: { problem: problem ?? '', times },
    last30: raw.breakdowns.filter((b) => b.days <= 29).length,
    openPart: part ? { part, stock: raw.stock[part] ?? 0 } : null,
  };
}

const HEADLINE: Record<MachineData['state'], string> = {
  down: 'This machine is !!down!!: spindle alarm for 2 h 40 min. {{person:neel-s|Neel S}} is on it.',
  risk: 'This machine is ~~at risk~~: **{n} breakdowns** in 30 days. Inspect it before the next one.',
  pm: 'This machine is in ++planned maintenance++, back by 14:00. Nothing to decide.',
  idle: 'This machine is **idle**: no job loaded since yesterday. Find out why.',
  run: 'This machine is ++running well++: no breakdown in the last 30 days.',
};

/** The answer first: its state in one sentence (and an overdue PM, which is never hidden), its why behind a click. */
export function verdictOf(m: MachineData, f: Facts): VerdictData {
  const late = f.overdueDays ? ` Its PM is !!${f.overdueDays} days overdue!!.` : '';
  const why: Point[] = [...m.why];
  if (f.overdueDays) why.push(pt(`PM was due **${f.nextPm}**, ${f.overdueDays} days ago`));
  return {
    context: 'Friday 20-Nov-2026',
    headline: pt(HEADLINE[m.state].replace('{n}', String(f.last30)) + late),
    why,
  };
}

/** The one thing to do, or the plain statement that there is nothing to do. */
export function nextOf(m: MachineData, f: Facts): NextAction {
  if (m.state === 'down' && f.openPart) {
    const none = f.openPart.stock === 0;
    return {
      title: pt('Get {{person:neel-s|Neel S}} the part for the repair'),
      why: pts(
        none
          ? `${f.openPart.part}: !!none in stock!!`
          : `${f.openPart.part}: ++${f.openPart.stock} in stock++`,
        'Every hour down is **an hour of lost output**',
      ),
      action: none ? 'Order the part' : 'Reserve the part',
      doneText: none ? 'Part ordered' : 'Part reserved',
    };
  }
  if (f.overdueDays)
    return {
      title: pt('Book the overdue PM'),
      why: pts(`Due **${f.nextPm}**, !!${f.overdueDays} days ago!!`),
      action: 'Book the PM',
      doneText: 'PM booked',
    };
  const none = (title: string, ...lines: string[]): NextAction => ({
    title: pt(title),
    why: pts(...lines),
  });
  switch (m.state) {
    case 'risk':
      return {
        title: pt('Inspect it before the next breakdown'),
        why: pts(
          `**${f.last30} breakdowns** in 30 days`,
          `Most often: ~~${f.top.problem}~~, **${f.top.times} times** in 12 months`,
        ),
        action: 'Schedule an inspection',
        doneText: 'Inspection booked',
      };
    case 'idle':
      return {
        title: pt('Find out why it is idle'),
        why: pts('No job loaded since **yesterday**'),
        action: 'Ask the cell lead',
        doneText: 'Cell lead asked',
      };
    case 'pm':
      return none('Nothing to do: the PM ends by 14:00');
    default:
      return none('Nothing to do: it is running well', `Next PM **${f.nextPm}**`);
  }
}

export const hoursText = (tenths: number) => glue(`${(tenths / 10).toFixed(1)} h`);
