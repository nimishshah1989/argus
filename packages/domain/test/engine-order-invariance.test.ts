import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '@uptimo/shared';
import { run, type EngineData, type EngineResult, type FigureValue } from '../src/index.js';
import { ENGINE_DATA } from './answer-key/fixture.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ENGINE, HAND } from './many-years/hand.js';
import { originalIds, rekeyToUuids } from './answer-key/rekey.js';
import { loadedLikeTheServer, shuffledWithinDays } from './answer-key/reorder.js';

/**
 * A plant's figures are a function of what it recorded, never of the UUIDs its rows were given or of the order of
 * the rows of one day. The server hands the engine reports by date and then by UUID, so two plants with the same
 * records and different UUIDs used to print different numbers (a sum lands on a rounding edge) and different row
 * orders (a tie between two same-day rows broke by id). Every figure is run over each plant loaded like the server
 * under two different UUID assignments, and with each day's rows in a random order, and must be identical to the
 * plant's own once the UUIDs are mapped back to the fixture's ids.
 *
 * The order of the days is the caller's and may show: a sum over a plant sent in date order and the same sum over a
 * plant sent grouped by machine can differ in the last decimal, and the answer key's own digits are the fixture's
 * order. So the loaded-like-the-server runs are held against the fixture's ids loaded the same way, and the
 * shuffled-day runs against the fixture's own order.
 */

const UUID_IN_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

interface Plant {
  name: string;
  data: EngineData;
  asOf: string;
  span?: { from: string; to: string };
}

const PLANTS: readonly Plant[] = [
  { name: 'the answer-key plant', data: ENGINE_DATA, asOf: '2026-11-11' },
  {
    name: 'the answer-key plant over a span',
    data: ENGINE_DATA,
    asOf: '2026-11-11',
    span: { from: '2026-04-01', to: '2026-10-31' },
  },
  {
    name: 'the two-year plant over both years',
    data: MANY_YEARS,
    asOf: AS_OF_ENGINE,
    span: { from: HAND.both.from, to: HAND.both.to },
  },
];

type Against = 'the fixture order' | 'the fixture ids loaded like the server';

interface Variant {
  name: string;
  salt: string;
  order: (data: EngineData) => EngineData;
  against: Against;
}

const VARIANTS: readonly Variant[] = [
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

const read = <T>(value: T, back: ReadonlyMap<string, string>): T =>
  JSON.parse(JSON.stringify(value).replace(UUID_IN_TEXT, (uuid) => back.get(uuid) ?? uuid)) as T;

/** The first place two figure values differ, as a short text. */
function firstDifference(a: FigureValue, b: FigureValue): string {
  const [x, y] = [JSON.stringify(a), JSON.stringify(b)];
  let at = 0;
  while (x[at] === y[at]) at++;
  return `...${x.slice(Math.max(0, at - 70), at + 40)}  VS  ...${y.slice(Math.max(0, at - 70), at + 40)}`;
}

describe.each(PLANTS)('a figure does not depend on ids or same-day order: $name', (plant) => {
  const { data, asOf, span } = plant;
  const baseline: Record<Against, EngineResult> = {
    'the fixture order': run(data, asOf, DEFAULT_PROFILE, span),
    'the fixture ids loaded like the server': run(
      loadedLikeTheServer(data),
      asOf,
      DEFAULT_PROFILE,
      span,
    ),
  };

  it.each(VARIANTS)('gives the figures of $against with $name', ({ salt, order, against }) => {
    const plain = baseline[against];
    const keyed = salt === '' ? data : rekeyToUuids(data, salt);
    const result = run(order(keyed), asOf, DEFAULT_PROFILE, span);
    const back = salt === '' ? new Map<string, string>() : originalIds(data, salt);
    const differ = plain.figures.flatMap((figure, index) => {
      const other = read(result.figures[index]!, back);
      const [want, got] = [figure.value, other.value];
      const same =
        isDeepStrictEqual(want, got) &&
        isDeepStrictEqual([...other.drill.ids].sort(), [...figure.drill.ids].sort());
      return same ? [] : [`${figure.key}: ${firstDifference(want, got)}`];
    });
    expect(differ).toEqual([]);
  });
});
