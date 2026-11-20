/** The plant's loss rate, ₹ an hour of breakdown, as on the Dashboard's key figures. */
export const RATE = 3329;

/** One invented breakdown: the problem and the hours it cost, in tenths. */
export type Breakdown = { cause: string; tenths: number; week: number };

/** The weeks of the year so far (to 20-Nov-2026), the last 12 of which the trend shows. */
export const WEEKS_SO_FAR = 46;

/** What a machine's year is made of: its age, the hours planned to run, last year's totals, and its breakdowns by problem. */
type Recipe = {
  age: number;
  planned: number;
  last: { tenths: number; count: number };
  /** Problem, how many breakdowns, how many tenths of an hour they cost together. */
  causes: [string, number, number][];
};

const RECIPES: Record<string, Recipe> = {
  'VC-67': {
    age: 7,
    planned: 6480,
    last: { tenths: 441, count: 21 },
    causes: [
      ['Axis drive', 13, 352],
      ['Coolant', 6, 98],
      ['Tool clamp', 4, 74],
      ['ATC arm', 3, 49],
      ['Other', 2, 11],
    ],
  },
  'VC-18': {
    age: 6,
    planned: 6480,
    last: { tenths: 309, count: 17 },
    causes: [
      ['Axis drive', 2, 58],
      ['Coolant', 4, 62],
      ['Tool clamp', 2, 41],
      ['ATC arm', 2, 32],
      ['Other', 1, 20],
    ],
  },
  'VC-94': {
    age: 9,
    planned: 6360,
    last: { tenths: 402, count: 19 },
    causes: [
      ['Axis drive', 10, 288],
      ['Coolant', 3, 45],
      ['Tool clamp', 3, 52],
      ['ATC arm', 4, 66],
      ['Other', 2, 24],
    ],
  },
  'VC-24': {
    age: 5,
    planned: 6480,
    last: { tenths: 198, count: 12 },
    causes: [
      ['Axis drive', 3, 72],
      ['Coolant', 5, 88],
      ['Tool clamp', 2, 37],
      ['ATC arm', 1, 18],
      ['Other', 2, 21],
    ],
  },
  'VC-35': {
    age: 3,
    planned: 6480,
    last: { tenths: 96, count: 6 },
    causes: [
      ['Axis drive', 1, 20],
      ['Coolant', 2, 31],
      ['Tool clamp', 1, 15],
      ['Other', 1, 9],
    ],
  },
};

export const COMPARABLE = Object.keys(RECIPES);

/** One machine's year: its breakdowns, rebuilt from the recipe so a problem's hours are its breakdowns' added up. */
export type Year = {
  code: string;
  age: number;
  planned: number;
  last: Recipe['last'];
  breakdowns: Breakdown[];
};

export function yearOf(code: string): Year | null {
  const r = RECIPES[code];
  if (!r) return null;
  const seed = code.charCodeAt(3);
  const list = r.causes.flatMap(([cause, count, tenths]) =>
    Array.from({ length: count }, (_, i) => ({
      cause,
      tenths: Math.floor(tenths / count) + (i < tenths % count ? 1 : 0),
    })),
  );
  // Spread over the weeks by a step coprime to 46, so no two breakdowns of a machine share a week.
  const breakdowns = list.map((b, k) => ({ ...b, week: (k * 11 + seed) % WEEKS_SO_FAR }));
  return { code, age: r.age, planned: r.planned, last: r.last, breakdowns };
}
