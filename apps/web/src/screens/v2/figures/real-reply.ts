import { DEFAULT_PROFILE } from '@uptimo/shared';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { actionCenterBoard, run } from '@uptimo/domain';
import type { ActionCenterBoardReply } from '@uptimo/shared';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';

/**
 * The engine's own reply for the frozen 11 November answer key, for tests: the real engine run over the real-shaped
 * data, exactly what `GET /analytics/figures` carries, so an adapter is tested against what the server says and not
 * against rows written for the test.
 */
export const AS_OF = '2026-11-11';

export function realReply(asOf: string = AS_OF): FiguresReply {
  const result = run(ENGINE_DATA, asOf, DEFAULT_PROFILE);
  return {
    asOf,
    profile: {} as FiguresReply['profile'],
    excludedMachines: 0,
    rows: { machines: 0, moves: 0, tickets: 0, tasks: 0, reports: 0, people: 0 },
    figures: result.figures as unknown as FiguresReply['figures'],
  };
}

/** Every string a model prints, in one list: a completeness test asks whether a figure of the reply is among them. */
export function printed(model: unknown): string[] {
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === 'string') found.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(model);
  return found;
}

export const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

/** One stored acknowledgement as the server keeps it under `nudge:<key>`. */
export type StoredAck = {
  status: 'ack' | 'snooze' | 'done';
  owner: string;
  due: string;
  note: string;
  at: string;
  until?: string;
};

/**
 * The Action Center's board as the server answers it for the same frozen plant: the real engine's `actionCenterBoard`
 * over the answer-key data, with the workbook's own acknowledgements and, as after a write, `acks` replacing or adding
 * the stored ones (the server's `boardAfter` does exactly this).
 */
export function realBoard(acks: Record<string, StoredAck> = {}): ActionCenterBoardReply {
  const settings = ENGINE_DATA.settings ?? { excludedMachineIds: [], problemFixes: {} };
  const data = {
    ...ENGINE_DATA,
    settings: { ...settings, nudgeAcks: { ...(settings.nudgeAcks ?? {}), ...acks } },
  };
  return actionCenterBoard({
    data,
    asOf: AS_OF,
    profile: DEFAULT_PROFILE,
  }) as unknown as ActionCenterBoardReply;
}
