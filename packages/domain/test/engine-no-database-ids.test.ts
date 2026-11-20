import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '@uptimo/shared';
import { run, type EngineData, type FigureValue } from '../src/index.js';
import { ENGINE_DATA } from './answer-key/fixture.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ENGINE, HAND } from './many-years/hand.js';
import { isUuid, originalIds, rekeyToUuids } from './answer-key/rekey.js';
import { REFERENCES, type Reference } from './answer-key/references.js';

/**
 * On a real plant every machine, ticket, report, move and person id is a UUID, and the fixture's ids equal their
 * codes. This runs every figure over the answer-key plant with all of them re-keyed to UUIDs (codes untouched) and
 * does two things. It walks each value for a UUID in a position a person reads (a table cell, a label, a heading, a
 * text line, a chart category), and it checks that the figures are the same as over the original ids, so no text,
 * order or position is derived from an id. A field a web adapter looks a row up by is a reference: it stays an id, is
 * listed below with the reason, and the adapter prints the code (or the figure carries it beside the id).
 */

const UUID_IN_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

interface Offender {
  figure: string;
  path: string;
  sample: string;
}

function walk(figure: string, value: FigureValue, path: string, found: Offender[]): void {
  if (typeof value === 'string') {
    if (UUID_IN_TEXT.test(value)) found.push({ figure, path, sample: value.slice(0, 90) });
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value as readonly FigureValue[]) walk(figure, item, `${path}[]`, found);
    return;
  }
  for (const [key, item] of Object.entries(value as { readonly [key: string]: FigureValue })) {
    const name = isUuid(key) ? '{id}' : key;
    const here = path === '' ? name : `${path}.${name}`;
    if (UUID_IN_TEXT.test(key)) found.push({ figure, path: here, sample: key.slice(0, 90) });
    walk(figure, item, here, found);
  }
}

const applies = (ref: Reference, figure: string, path: string): boolean =>
  (ref.figure === undefined || ref.figure === figure) && ref.path.test(path);

const isReference = (offender: Offender): boolean =>
  REFERENCES.some((ref) => applies(ref, offender.figure, offender.path));

/**
 * Every id a reference lets through must have its printable code beside it: if the engine stops writing the code, a
 * screen that falls back to the id would print a UUID again. `seen` counts the checks made, so none is vacuous.
 */
interface CodeChecks {
  figure: string;
  found: string[];
  seen: Set<Reference>;
}

function missingCodes(checks: CodeChecks, value: FigureValue, path: string): void {
  const { figure, found, seen } = checks;
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value as readonly FigureValue[]) {
      missingCodes(checks, item, `${path}[]`);
    }
    return;
  }
  const own = value as { readonly [key: string]: FigureValue };
  for (const [key, item] of Object.entries(own)) {
    const here = path === '' ? key : `${path}.${isUuid(key) ? '{id}' : key}`;
    for (const ref of REFERENCES) {
      if (ref.codeBeside === undefined || !applies(ref, figure, here)) continue;
      seen.add(ref);
      const code = own[ref.codeBeside];
      if (typeof code !== 'string' || code === '' || UUID_IN_TEXT.test(code)) {
        found.push(`${figure}  ${here}  has no printable \`${ref.codeBeside}\` beside it`);
      }
    }
    missingCodes(checks, item, here);
  }
}

interface Plant {
  name: string;
  data: EngineData;
  asOf: string;
  span?: { from: string; to: string };
}

/** The 2026 answer-key plant as a whole and over a span, and the two-year plant over both of its years. */
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

describe.each(PLANTS)('the engine prints no database id: $name', ({ data, asOf, span }) => {
  const result = run(rekeyToUuids(data), asOf, DEFAULT_PROFILE, span);

  it('runs over a plant whose ids are UUIDs, so the guard is not vacuous', () => {
    const drilled = result.figures.flatMap((figure) => figure.drill.ids);
    expect(drilled.length).toBeGreaterThan(0);
    expect(drilled.every(isUuid)).toBe(true);
    expect(result.figures.filter((figure) => figure.status === 'ready').length).toBeGreaterThan(10);
  });

  it('shows no UUID in a field a person reads', () => {
    const found: Offender[] = [];
    for (const figure of result.figures) walk(figure.key, figure.value, '', found);
    const printed = new Map<string, Offender>();
    for (const offender of found.filter((one) => !isReference(one))) {
      printed.set(`${offender.figure}  ${offender.path}`, offender);
    }
    const summary = [...printed].map(([where, one]) => `${where}  e.g. ${one.sample}`).sort();
    expect(summary).toEqual([]);
  });

  it('carries a printable code beside every id a screen looks a machine up by', () => {
    const found: string[] = [];
    const seen = new Set<Reference>();
    for (const figure of result.figures) {
      missingCodes({ figure: figure.key, found, seen }, figure.value, '');
    }
    expect([...new Set(found)]).toEqual([]);
    if (data === ENGINE_DATA && span === undefined) {
      const coded = REFERENCES.filter((ref) => ref.codeBeside !== undefined);
      expect(coded.filter((ref) => !seen.has(ref)).map((ref) => String(ref.path))).toEqual([]);
    }
  });

  it('gives the same figures whatever the ids are: no text, order or position comes from an id', () => {
    const back = originalIds(data);
    const read = <T>(value: T): T =>
      JSON.parse(
        JSON.stringify(value).replace(
          new RegExp(UUID_IN_TEXT, 'g'),
          (uuid) => back.get(uuid) ?? uuid,
        ),
      ) as T;
    const plain = run(data, asOf, DEFAULT_PROFILE, span);
    const differ = plain.figures
      .filter((figure, index) => {
        const other = read(result.figures[index]!);
        return (
          !isDeepStrictEqual(other.value, figure.value) ||
          !isDeepStrictEqual([...other.drill.ids].sort(), [...figure.drill.ids].sort())
        );
      })
      .map((figure) => figure.key);
    expect(differ).toEqual([]);
  });
});
