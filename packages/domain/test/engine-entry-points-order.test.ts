import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '@uptimo/shared';
import {
  actionCenterBoard,
  annualReport,
  frozenForMonth,
  monthActuals,
  monthlyReport,
  workbookSheets,
  type EngineData,
} from '../src/index.js';
import { ENGINE_DATA } from './answer-key/fixture.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ENGINE } from './many-years/hand.js';
import { originalIds, rekeyToUuids, uuidFor } from './answer-key/rekey.js';
import { loadedLikeTheServer } from './answer-key/reorder.js';
import { VARIANTS, read, type Against } from './answer-key/variants.js';
import { EXPORT_DATA } from './answer-key/workbook-export.js';

/**
 * The server calls these domain functions directly on the plant `loadEngineData` returns, not through `run`: the PDF
 * reports, the Action Center and its nudges, the Excel workbook and the forecast scoring and freezing. Each must
 * give the same answer for the same records whatever their ids and however the database ordered a day's rows,
 * on several run dates (a sum lands on a rounding edge on one date and not on another).
 */

const month = (asOf: string): string => `${asOf.slice(0, 7)}-01`;

const ENTRY_POINTS: readonly { name: string; call: (data: EngineData, asOf: string) => unknown }[] =
  [
    { name: 'monthlyReport', call: (data, asOf) => monthlyReport(data, DEFAULT_PROFILE, asOf) },
    { name: 'annualReport', call: (data, asOf) => annualReport(data, DEFAULT_PROFILE, asOf) },
    {
      name: 'actionCenterBoard',
      call: (data, asOf) => actionCenterBoard({ data, asOf, profile: DEFAULT_PROFILE }),
    },
    {
      name: 'frozenForMonth',
      call: (data, asOf) => frozenForMonth(data, DEFAULT_PROFILE, month(asOf)),
    },
    { name: 'monthActuals', call: (data, asOf) => [...monthActuals(data, month(asOf))] },
  ];

const PLANTS: readonly { name: string; data: EngineData; dates: readonly string[] }[] = [
  {
    name: 'the answer-key plant',
    data: ENGINE_DATA,
    dates: ['2026-03-15', '2026-07-10', '2026-09-30', '2026-10-31'],
  },
  {
    name: 'the two-year plant',
    data: MANY_YEARS,
    dates: ['2025-06-30', '2026-03-31', '2026-12-31', AS_OF_ENGINE],
  },
];

describe.each(PLANTS)('a direct caller gets the same answer whatever the ids: $name', (plant) => {
  describe.each(ENTRY_POINTS)('$name', ({ call }) => {
    it.each(plant.dates)('on %s', (asOf) => {
      const baseline: Record<Against, unknown> = {
        'the fixture order': call(plant.data, asOf),
        'the fixture ids loaded like the server': call(loadedLikeTheServer(plant.data), asOf),
      };
      const differ = VARIANTS.filter(({ salt, order, against }) => {
        const keyed = salt === '' ? plant.data : rekeyToUuids(plant.data, salt);
        const back = salt === '' ? new Map<string, string>() : originalIds(plant.data, salt);
        return !isDeepStrictEqual(read(call(order(keyed), asOf), back), baseline[against]);
      }).map((variant) => variant.name);
      expect(differ).toEqual([]);
    });
  });
});

describe('the Excel workbook gets the same sheets whatever the ids', () => {
  const sheetsOf = (data: EngineData, salt: string) =>
    workbookSheets({
      ...EXPORT_DATA,
      data,
      spareCosts: Object.fromEntries(
        Object.entries(EXPORT_DATA.spareCosts ?? {}).map(([id, slots]) => [
          salt === '' ? id : uuidFor('report', id, salt),
          slots,
        ]),
      ),
    });

  it.each(VARIANTS)('with $name', ({ salt, order, against }) => {
    const want = {
      'the fixture order': sheetsOf(ENGINE_DATA, ''),
      'the fixture ids loaded like the server': sheetsOf(loadedLikeTheServer(ENGINE_DATA), ''),
    }[against];
    const keyed = salt === '' ? ENGINE_DATA : rekeyToUuids(ENGINE_DATA, salt);
    const back = salt === '' ? new Map<string, string>() : originalIds(ENGINE_DATA, salt);
    expect(read(sheetsOf(order(keyed), salt), back)).toEqual(want);
  });
});
