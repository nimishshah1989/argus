import type { EngineData } from '../../src/index.js';
import { loadedLikeTheServer, shuffledWithinDays } from './reorder.js';

const UUID_IN_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** A value with every UUID in it read back as the id the fixture holds. */
export const read = <T>(value: T, back: ReadonlyMap<string, string>): T =>
  JSON.parse(JSON.stringify(value).replace(UUID_IN_TEXT, (uuid) => back.get(uuid) ?? uuid)) as T;

export type Against = 'the fixture order' | 'the fixture ids loaded like the server';

export interface Variant {
  name: string;
  salt: string;
  order: (data: EngineData) => EngineData;
  against: Against;
}

export const VARIANTS: readonly Variant[] = [
  {
    name: 'UUIDs set A, loaded by date then id',
    salt: 'a',
    order: loadedLikeTheServer,
    against: 'the fixture ids loaded like the server',
  },
  {
    name: 'UUIDs set B, loaded by date then id',
    salt: 'b',
    order: loadedLikeTheServer,
    against: 'the fixture ids loaded like the server',
  },
  {
    name: 'UUIDs set C, each day shuffled',
    salt: 'c',
    order: (data) => shuffledWithinDays(data, 7),
    against: 'the fixture order',
  },
  {
    name: 'the fixture ids, each day shuffled',
    salt: '',
    order: (data) => shuffledWithinDays(data, 99),
    against: 'the fixture order',
  },
];
