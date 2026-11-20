import type { FiguresReply } from '@uptimo/shared/analytics';
import type { Machine } from '@uptimo/shared/config';
import type { Ticket } from '@uptimo/shared/replies';
import { machineRecord, type MachineRecord } from '../../analytics/machine-record.js';
import { reliabilityOf } from '../../analytics/reliability-values.js';
import { sentence } from '../figures/point.js';
import { dayText, machineChip, sourceLine, type Translate } from '../figures/read.js';
import { commonWords } from '../figures/words.js';
import { movesBlock, nameplateFacts, recordBlocks, tasksBlock } from './blocks.js';
import { drillOf, number } from './format.js';
import { kpisOf } from './kpis.js';
import { reliabilityBlock, sparesBlock } from './reliability.js';
import type { MachinePageModel } from './model.js';

/** What the plant holds beside the engine's reply: its machine list, this machine's open tickets, its time zone. */
export type MachineFacts = {
  /** The route's id: the machine's id, or its code (a drawer's link names the code). */
  param: string;
  machines: readonly Pick<Machine, 'id' | 'code' | 'category' | 'cell'>[];
  /** Null when the tickets could not be read. */
  tickets: readonly Ticket[] | null;
  timeZone: string;
};

/** Who the machine is: its code, its type and its cell, from the engine's record and then the plant's list. */
function whoOf(record: MachineRecord, listed: Pick<Machine, 'category' | 'cell'> | undefined) {
  const code = record.machine.code;
  const type = record.machine.category ?? listed?.category ?? '';
  const cell = record.machine.cell ?? listed?.cell ?? null;
  return {
    type,
    cell,
    machine: {
      code,
      chip: machineChip(code, type),
      type,
      cell: cell ? ({ kind: 'cell', id: cell, label: cell } as const) : null,
    },
  };
}

/** The line under the verdict: the day the figures are for, the type and the cell. */
function contextOf(asOf: string, who: { type: string; cell: string | null }, t: Translate): string {
  return [t('analytics.asOf', { date: dayText(asOf) }), who.type, who.cell]
    .filter((part) => part !== null && part !== '')
    .join(' · ');
}

/** The reliability block for this machine, and the one line to print when the engine has none (not computed, or not held). */
function reliabilityFor(reply: Pick<FiguresReply, 'figures'>, machineId: string, t: Translate) {
  const figure = reply.figures.find((candidate) => candidate.key === 'reliability');
  const ready = figure?.status === 'ready';
  return {
    view: ready ? reliabilityOf(figure.value, machineId) : null,
    note: t(ready ? 'analytics.machine.notAvailable' : 'analytics.notComputed'),
  };
}

/** What has gone wrong: the last breakdown and the most frequent problem, with the way to every breakdown. */
function breakdownsBlock(
  record: MachineRecord,
  machineId: string,
  t: Translate,
): MachinePageModel['breakdowns'] {
  const none = t('analytics.machine.notAvailable');
  const bd = record.breakdowns;
  const title = t('analytics.machine.breakdowns');
  return {
    title,
    facts: [
      {
        id: 'last',
        label: t('analytics.machine.lastBreakdown'),
        value: bd?.lastOn ? dayText(bd.lastOn) : none,
      },
      {
        id: 'top',
        label: t('analytics.machine.topProblem'),
        value: bd?.topProblem?.problem ?? none,
      },
    ],
    drill: drillOf({ machineId, part: 'breakdowns', ids: record.drills.breakdowns }, title, t),
  };
}

/** The state of health in one sentence: what the breakdowns have cost and how long a repair takes. */
function verdictOf(
  record: MachineRecord,
  context: string,
  t: Translate,
): MachinePageModel['verdict'] {
  const bd = record.breakdowns;
  const code = record.machine.code;
  const unit = t('analytics.machine.unit.hours');
  return {
    headline:
      bd?.count != null && bd.hours != null && bd.mttr != null
        ? sentence(t('v2t.mp.headline'), {
            code,
            count: number(bd.count, 0),
            hours: `${number(bd.hours, 2)} ${unit}`,
            mttr: `${number(bd.mttr, 2)} ${unit}`,
          })
        : sentence(t('v2t.mp.headlineNone'), { code }),
    why: [[{ text: t('v2t.mp.why1') }], [{ text: t('v2t.mp.why2') }]],
    context,
  };
}

/**
 * One machine's page from the engine's reply and what the plant holds. Null when the engine has no page for the machine
 * (the figure is not computed, or holds no record for it): the screen then says so instead of inventing one.
 */
export function machinePageModel(
  reply: Pick<FiguresReply, 'asOf' | 'figures'>,
  facts: MachineFacts,
  t: Translate,
): MachinePageModel | null {
  const machine = facts.machines.find((m) => m.id === facts.param || m.code === facts.param);
  const machineId = machine?.id ?? facts.param;
  const page = reply.figures.find((figure) => figure.key === 'machine-page');
  const record = page?.status === 'ready' ? machineRecord(page.value, machineId) : null;
  if (record === null) return null;
  const { view, note } = reliabilityFor(reply, machineId, t);
  const nameplate = t('analytics.machine.nameplate');
  const words = commonWords(t);
  const who = whoOf(record, machine);
  return {
    machine: { id: machineId, ...who.machine },
    verdict: verdictOf(record, contextOf(reply.asOf, who, t), t),
    kpis: kpisOf(record, reply.asOf, machineId, t),
    breakdowns: breakdownsBlock(record, machineId, t),
    reliability: reliabilityBlock(view, note, machineId, t),
    spares: sparesBlock(view, note, machineId, t),
    tasks: tasksBlock(facts.tickets, { asOf: reply.asOf, timeZone: facts.timeZone }, t),
    moves: movesBlock(record, machineId, t),
    nameplate: {
      title: nameplate,
      facts: nameplateFacts(record, t),
      none: t('analytics.machine.notAvailable'),
      drill: drillOf({ machineId, part: 'machine', ids: [machineId] }, nameplate, t),
    },
    ...recordBlocks(record, machineId, t),
    source: sourceLine(words.source, reply.asOf),
    words: { why: words.why, seeRows: t('analytics.machine.seeRows') },
  };
}
