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

/** A machine's id as the server sends it: a UUID that is not its code (the answer key sets every id equal to its code). */
const uuidFor = (code: string): string => {
  const hex = [...code].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  const body = `${hex}${'0'.repeat(32)}`.slice(0, 32);
  return `${body.slice(0, 8)}-${body.slice(8, 12)}-4${body.slice(13, 16)}-a${body.slice(17, 20)}-${body.slice(20, 32)}`;
};

/** A machine's code from its UUID in `realReplyWithUuids`, as the plant's machine list answers it; null for an id it does not list. */
export const codeOfUuid = (id: string): string | null =>
  ENGINE_DATA.machines.find((machine) => uuidFor(machine.id) === id)?.code ?? null;

/** The engine data with every machine keyed by a UUID: `machines[].id` and each `machineId` that points at one. */
function rekeyed(data: typeof ENGINE_DATA): typeof ENGINE_DATA {
  const ids = new Map(data.machines.map((machine) => [machine.id, uuidFor(machine.id)]));
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        key === 'machineId' && typeof inner === 'string' ? (ids.get(inner) ?? inner) : walk(inner),
      ]),
    );
  };
  const out = walk(data) as typeof ENGINE_DATA;
  return {
    ...out,
    machines: out.machines.map((machine) => ({
      ...machine,
      id: ids.get(machine.id) ?? machine.id,
    })),
  };
}

/** The same reply as `realReply`, with machine ids that are UUIDs, as the server's are: a screen must print codes and look up by id. */
export const realReplyWithUuids = (): FiguresReply => replyFor(rekeyed(ENGINE_DATA));

export function realReply(): FiguresReply {
  return replyFor(ENGINE_DATA);
}

function replyFor(data: typeof ENGINE_DATA): FiguresReply {
  const result = run(data, AS_OF, DEFAULT_PROFILE);
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
