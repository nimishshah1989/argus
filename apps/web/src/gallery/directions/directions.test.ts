import { describe, expect, it } from 'vitest';
import { STATUS, type StatusGroup, type StatusId } from '../../ui/status/index.js';
import { instrument } from './direction-instrument.js';
import {
  formatIN,
  paletteProblems,
  ROLES,
  statusRole,
  TONE_ROLES,
  type Direction,
  type Palette,
  type Role,
} from './variant.js';

const everyStatus = (Object.keys(STATUS) as StatusGroup[]).flatMap((group) =>
  (Object.keys(STATUS[group]) as StatusId<typeof group>[]).map((id) => ({
    group,
    id,
    tone: (STATUS[group] as Record<string, { tone: string }>)[id]!.tone,
  })),
);

describe('the status to tone map', () => {
  it('gives every one of the 40 statuses a tone role', () => {
    expect(everyStatus).toHaveLength(40);
    for (const s of everyStatus) {
      expect(TONE_ROLES, `${s.group}.${s.id}`).toContain(statusRole({ group: s.group, id: s.id }));
    }
  });

  it('reads danger as critical, warning and hold as attention, ok as good, info and moved as info, muted as neutral', () => {
    const wanted: Record<string, string> = {
      danger: 'critical',
      hold: 'attention',
      warning: 'attention',
      moved: 'info',
      info: 'info',
      ok: 'good',
      muted: 'neutral',
    };
    for (const s of everyStatus) {
      if (s.group === 'ticket' && s.id === 'running') continue;
      expect(statusRole({ group: s.group, id: s.id }), `${s.group}.${s.id}`).toBe(wanted[s.tone]);
    }
  });

  it('shows Running grey, Waiting amber and Transferred blue', () => {
    expect(statusRole({ group: 'ticket', id: 'running' })).toBe('neutral');
    expect(statusRole({ group: 'ticket', id: 'waiting' })).toBe('attention');
    expect(statusRole({ group: 'ticket', id: 'transferred' })).toBe('info');
    expect(statusRole({ group: 'ticket', id: 'stopped' })).toBe('critical');
  });
});

describe('the role list', () => {
  it('names 10 neutral and accent roles and ink, tint and fill for each of the 5 tones', () => {
    const tones = ['critical', 'attention', 'good', 'info', 'neutral'];
    expect([...ROLES].sort()).toEqual(
      [
        ...[
          'page',
          'surface',
          'surface-2',
          'line',
          'control',
          'ink',
          'ink-2',
          'accent',
          'on-accent',
          'accent-tint',
        ],
        ...tones.flatMap((t) => [`${t}-ink`, `${t}-tint`, `${t}-fill`]),
      ].sort(),
    );
  });
});

describe('a palette', () => {
  const full = {
    ...Object.fromEntries(ROLES.map((r, i) => [r, `#${(i + 16).toString(16)}0000`])),
    series: [
      '#101010',
      '#202020',
      '#303030',
      '#404040',
      '#505050',
      '#606060',
      '#707070',
      '#808080',
    ],
    seq: ['#111111', '#222222', '#333333', '#444444', '#555555'],
    div: ['#121212', '#232323', '#343434', '#454545', '#565656'],
  } as unknown as Palette;
  const problems = (p: object) => paletteProblems(p as Palette);

  it('has no problem when every role, 8 series and two 5-step ramps are set', () => {
    expect(problems(full)).toEqual([]);
  });

  it('names a missing role, a short series and a short ramp', () => {
    const broken = {
      ...full,
      'good-fill': '',
      series: full.series.slice(0, 7),
      seq: full.seq.slice(0, 4),
    };
    expect(problems(broken)).toEqual([
      'good-fill is not a hex colour',
      'series has 7 colours, not 8',
      'seq has 4 steps, not 5',
    ]);
  });

  it('names a series or ramp entry that is not a hex colour', () => {
    const broken = {
      ...full,
      series: ['red', ...full.series.slice(1)],
      div: ['#12', ...full.div.slice(1)],
    };
    expect(problems(broken)).toEqual(['series 1 is not a hex colour', 'div 1 is not a hex colour']);
  });

  it('names a series colour that repeats an earlier one, whatever its letter case', () => {
    const twin = {
      ...full,
      series: [
        full.series[0],
        '#abcdef',
        ...full.series.slice(2, 5),
        '#ABCDEF',
        ...full.series.slice(6),
      ],
    };
    expect(problems(twin)).toEqual(['series 6 repeats series 2']);
  });

  it('names a series that equals a status colour, whatever its letter case', () => {
    const clash = {
      ...full,
      series: [full['critical-fill'].toUpperCase(), ...full.series.slice(1)],
    };
    expect(problems(clash)).toEqual(['series 1 equals critical-fill']);
  });
});

describe('Indian grouping', () => {
  it('prints 1000000 as 10,00,000 and keeps decimals', () => {
    expect(formatIN(1_000_000)).toBe('10,00,000');
    expect(formatIN(1279)).toBe('1,279');
    expect(formatIN(3060.1)).toBe('3,060.1');
    expect(formatIN(99.32)).toBe('99.32');
  });

  it('rounds to at most 3 decimals', () => {
    expect(formatIN(1.23456)).toBe('1.235');
  });

  it('prints a zero without a minus sign, however small the negative figure', () => {
    expect(formatIN(-0)).toBe('0');
    expect(formatIN(-0.0001)).toBe('0');
    expect(formatIN(-1_250_000)).toBe('-12,50,000');
  });

  it('prints an em dash for a figure that is not a number', () => {
    expect(formatIN(Number.NaN)).toBe('\u2014');
    expect(formatIN(Number.POSITIVE_INFINITY)).toBe('\u2014');
    expect(formatIN(Number.NEGATIVE_INFINITY)).toBe('\u2014');
  });
});

const DIRECTIONS: Record<string, Direction> = { instrument };

const channel = (hex: string, at: number) => {
  const c = parseInt(hex.slice(at, at + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) =>
  0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const hue = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const span = Math.max(r, g, b) - Math.min(r, g, b);
  if (span === 0) return null;
  const h =
    r === Math.max(r, g, b)
      ? (g - b) / span
      : g === Math.max(r, g, b)
        ? 2 + (b - r) / span
        : 4 + (r - g) / span;
  return (h * 60 + 360) % 360;
};
const RESERVED_HUES = [
  [345, 50],
  [90, 160],
  [205, 235],
] as const;

describe.each(Object.entries(DIRECTIONS))('the %s direction', (_slug, d) => {
  const themes = [
    ['light', d.light],
    ['dark', d.dark],
  ] as const;
  const tones = TONE_ROLES.map((t) => ({
    ink: `${t}-ink` as Role,
    tint: `${t}-tint` as Role,
    fill: `${t}-fill` as Role,
  }));
  const grounds = ['page', 'surface', 'surface-2'] as const;

  const below = (min: number, pairs: (p: Palette) => [string, string, string][]) =>
    themes.flatMap(([name, p]) =>
      pairs(p)
        .filter(([, fg, bg]) => contrast(fg, bg) < min)
        .map(
          ([label, fg, bg]) => `${name} ${label} ${fg} on ${bg}: ${contrast(fg, bg).toFixed(2)}`,
        ),
    );

  it('sets the same keys in light and dark and covers every role', () => {
    expect(Object.keys(d.dark).sort()).toEqual(Object.keys(d.light).sort());
    for (const [, p] of themes) expect(Object.keys(p)).toEqual(expect.arrayContaining([...ROLES]));
  });

  it('has no palette problem in either theme', () => {
    for (const [, p] of themes) expect(paletteProblems(p)).toEqual([]);
  });

  it('keeps every text pair at 4.5 or more', () => {
    expect(
      below(4.5, (p) => [
        ...grounds.flatMap((g): [string, string, string][] =>
          (['ink', 'ink-2', 'accent'] as const).map((r) => [r, p[r], p[g]]),
        ),
        ['accent', p.accent, p['accent-tint']],
        ['on-accent', p['on-accent'], p.accent],
        ...tones.flatMap((t): [string, string, string][] => [
          ...grounds.map((g): [string, string, string] => [t.ink, p[t.ink], p[g]]),
          [t.ink, p[t.ink], p[t.tint]],
        ]),
      ]),
    ).toEqual([]);
  });

  it('keeps every fill, series and border at 3 or more against page, surface and surface-2', () => {
    expect(
      below(3, (p) =>
        grounds.flatMap((g): [string, string, string][] => [
          ['control', p.control, p[g]],
          ...tones.map((t): [string, string, string] => [t.fill, p[t.fill], p[g]]),
          ...p.series.map((c, i): [string, string, string] => [`series ${i + 1}`, c, p[g]]),
        ]),
      ),
    ).toEqual([]);
  });

  it('keeps every series out of the red, green and info-blue bands', () => {
    const inBand = themes.flatMap(([name, p]) =>
      p.series
        .map((c) => ({ c, h: hue(c) }))
        .filter(({ h }) => h !== null)
        .filter(({ h }) =>
          RESERVED_HUES.some(([from, to]) =>
            from <= to ? h! >= from && h! <= to : h! >= from || h! <= to,
          ),
        )
        .map(({ c, h }) => `${name} ${c} at ${Math.round(h!)} degrees`),
    );
    expect(inBand).toEqual([]);
  });

  it('uses no grey series colour, because Running is the grey', () => {
    expect(themes.flatMap(([, p]) => p.series.filter((c) => hue(c) === null))).toEqual([]);
  });
});
