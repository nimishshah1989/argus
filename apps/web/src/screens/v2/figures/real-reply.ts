import { DEFAULT_PROFILE } from '@uptimo/shared';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { run } from '@uptimo/domain';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';

/**
 * The engine's own reply for the frozen 11 November answer key, for tests: the real engine run over the real-shaped
 * data, exactly what `GET /analytics/figures` carries, so an adapter is tested against what the server says and not
 * against rows written for the test.
 */
export const AS_OF = '2026-11-11';

export function realReply(): FiguresReply {
  const result = run(ENGINE_DATA, AS_OF, DEFAULT_PROFILE);
  return {
    asOf: AS_OF,
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
