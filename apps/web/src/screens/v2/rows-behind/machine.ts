import type { DrillType, FiguresReply } from '@uptimo/shared/analytics';
import type { MessageKey } from '@uptimo/shared/i18n';
import { machineRecord } from '../../analytics/machine-record.js';
import { reliabilityOf } from '../../analytics/reliability-values.js';
import type { Translate } from '../figures/read.js';

/**
 * The rows behind a block of one machine's page. The address names the machine and the block
 * (`machine-page:<machine id>:breakdowns`), because the rows are this machine's own, not a whole figure's.
 */
const PREFIX = 'machine-page:';
const PARTS = ['breakdowns', 'pm', 'moves', 'machine', 'fit', 'spares'] as const;
export type MachinePart = (typeof PARTS)[number];

/** What each block is called when its rows open: the heading the page gives it. */
const NAME: Record<MachinePart, MessageKey> = {
  breakdowns: 'analytics.machine.breakdowns',
  pm: 'analytics.machine.pm',
  moves: 'analytics.machine.moves',
  machine: 'analytics.machine.nameplate',
  fit: 'analytics.machine.reliability',
  spares: 'analytics.machine.spares',
};

/** The machine and block a drill key names, or null for any other key. */
export function machineDrillKey(key: string): { machineId: string; part: MachinePart } | null {
  if (!key.startsWith(PREFIX)) return null;
  const at = key.lastIndexOf(':');
  const part = PARTS.find((candidate) => candidate === key.slice(at + 1));
  const machineId = key.slice(PREFIX.length, at);
  return part !== undefined && at > PREFIX.length - 1 && machineId !== ''
    ? { machineId, part }
    : null;
}

export const machineDrillName = (part: MachinePart, t: Translate): string => t(NAME[part]);

type Counted = { type: DrillType; ids: string[] };

const recordOf = (reply: Pick<FiguresReply, 'figures'>, machineId: string) => {
  const page = reply.figures.find((figure) => figure.key === 'machine-page');
  return page?.status === 'ready' ? machineRecord(page.value, machineId) : null;
};

const reliabilityFor = (reply: Pick<FiguresReply, 'figures'>, machineId: string) => {
  const figure = reply.figures.find((candidate) => candidate.key === 'reliability');
  return figure?.status === 'ready' ? reliabilityOf(figure.value, machineId) : null;
};

/** The ids this machine's block counted, as the engine's own figures name them; null when the engine names none. */
export function machineDrill(key: string, reply: Pick<FiguresReply, 'figures'>): Counted | null {
  const named = machineDrillKey(key);
  if (named === null) return null;
  const { machineId, part } = named;
  const record = recordOf(reply, machineId);
  const view = reliabilityFor(reply, machineId);
  const found: Record<MachinePart, Counted | null> = {
    breakdowns: record && { type: 'ticket', ids: record.drills.breakdowns },
    pm: record && { type: 'ticket', ids: record.drills.pm },
    moves: record && { type: 'move', ids: record.drills.moves },
    machine: record && { type: 'machine', ids: [machineId] },
    fit: view && { type: 'ticket', ids: view.drill.fit },
    spares: view && { type: 'ticket', ids: view.drill.spares },
  };
  const own = found[part];
  return own !== null && own.ids.length > 0 ? own : null;
}
