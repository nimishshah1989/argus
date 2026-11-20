import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHART_PALETTE, CHART_VARS } from './chart-palette.js';
import { ratio, readTokens, type Tokens } from './contrast.js';

/**
 * Contrast guard for the tokens (design lock, 14 Nov 2026). Every status ink must reach 4.5:1 on its own
 * tint, in light and in dark; the accent must read as text and carry its own text as a fill. The kit's old
 * tone colours failed on their tints (Stopped 4.23, In progress 4.48, Support 4.45, Fixed 4.42, Closed 4.30).
 */

const TONES = ['danger', 'info', 'warning', 'hold', 'moved', 'ok', 'muted'];
const MIN = 4.5;

function colour(tokens: Tokens, name: string): string {
  let value = tokens[name];
  for (let hops = 0; value?.startsWith('var(') && hops < 4; hops++)
    value = tokens[value.slice(6, -1)];
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} is not a hex colour`);
  return value;
}

/** Every text pair the lock promises, as `[text, background]` token names. */
const PAIRS: [string, string][] = [
  ...TONES.map((t): [string, string] => [`color-${t}-ink`, `color-${t}-tint`]),
  ['color-accent-ink', 'color-accent'],
  ['color-accent-text', 'color-surface'],
  ['color-accent-text', 'color-accent-tint'],
  ['color-neutral-900', 'color-surface'],
  ['color-neutral-600', 'color-surface'],
  ['color-neutral-600', 'color-pressed'],
  ['color-neutral-900', 'color-pressed'],
  ['color-accent-text', 'color-pressed'],
];

/** The pairs under 4.5:1, as readable lines; empty when the set is fine. */
export function contrastErrors(tokens: Tokens): string[] {
  const errors: string[] = [];
  for (const [text, bg] of PAIRS) {
    const r = ratio(colour(tokens, text), colour(tokens, bg));
    if (r < MIN) errors.push(`${text} on ${bg}: ${r.toFixed(2)}`);
  }
  return errors;
}

describe('token contrast', () => {
  it('flags a status tone that is below 4.5:1 on its tint (planted)', () => {
    const planted = {
      'color-danger-ink': '#dc2626',
      'color-danger-tint': '#fdecec',
      'color-accent-ink': '#ffffff',
      'color-accent': '#0f766e',
      'color-accent-text': '#0f766e',
      'color-surface': '#ffffff',
      'color-accent-tint': '#e3f2f0',
      'color-neutral-900': '#1d1d1f',
      'color-neutral-600': '#6e6e73',
      'color-pressed': '#f2f2f5',
      ...Object.fromEntries(
        TONES.filter((t) => t !== 'danger').flatMap((t) => [
          [`color-${t}-ink`, '#000000'],
          [`color-${t}-tint`, '#ffffff'],
        ]),
      ),
    };
    expect(contrastErrors(planted)).toEqual(['color-danger-ink on color-danger-tint: 4.23']);
  });

  const { light, dark } = readTokens(
    readFileSync(new URL('./tokens.css', import.meta.url), 'utf8'),
  );

  it('keeps every ink, the accent and the text at 4.5:1 or better in light', () => {
    expect(contrastErrors(light)).toEqual([]);
  });

  it('keeps the same pairs at 4.5:1 or better in dark', () => {
    expect(contrastErrors(dark)).toEqual([]);
  });

  it('keeps the pressed fill (a card under a finger) at 4.5:1 under neutral-600, in light and dark', () => {
    for (const tokens of [light, dark])
      expect(
        ratio(colour(tokens, 'color-neutral-600'), colour(tokens, 'color-pressed')),
      ).toBeGreaterThanOrEqual(4.5);
  });

  it('gives dark its own accent: #14b8a6 with dark text, #0f766e stays in light', () => {
    expect(colour(light, 'color-accent')).toBe('#0f766e');
    expect(colour(dark, 'color-accent')).toBe('#14b8a6');
    expect(ratio(colour(dark, 'color-accent-ink'), colour(dark, 'color-accent'))).toBeGreaterThan(
      6.8,
    );
  });
});

/** The mark colours of ticket 81: a status fill, a family fill and a chart series must be seen on every ground. */
const MARK_MIN = 3;
/** The least CIELAB distance between two series: 20 for normal sight, 10 under deuteranopia or protanopia (a clear
 * difference; the palette measures 24.5, 11.2 and 17.0 in light and 26.7, 19.3 and 23.4 in dark). */
const DISTANCE = { normal: 20, cvd: 10 };
const GROUNDS = ['color-surface', 'color-neutral-100'];
const STATUS = ['good', 'watch', 'bad', 'neutral'];
const FAMILIES = ['availability', 'downtime', 'repairs', 'planned'];
const SERIES = CHART_VARS.series.map((v) => v.slice(2));

const MARKS = [
  ...STATUS.map((t) => `color-${t}-fill`),
  ...FAMILIES.map((f) => `color-family-${f}`),
  ...SERIES,
];
const INK_PAIRS: [string, string][] = [
  ...STATUS.flatMap((t): [string, string][] => [
    [`color-${t}-ink`, `color-${t}-tint`],
    [`color-${t}-ink`, 'color-surface'],
  ]),
  ...FAMILIES.map((f): [string, string] => [`color-family-${f}-ink`, `color-family-${f}-tint`]),
];

function lines(tokens: Tokens, pairs: [string, string][], min: number): string[] {
  return pairs.flatMap(([a, b]) => {
    const r = ratio(colour(tokens, a), colour(tokens, b));
    return r < min ? [`${a} on ${b}: ${r.toFixed(2)}`] : [];
  });
}

const marksOnGrounds = MARKS.flatMap((m) => GROUNDS.map((g): [string, string] => [m, g]));

/** CIELAB of a colour as a person with normal sight, deuteranopia or protanopia sees it (Machado 2009, severity 1). */
const SIM = {
  normal: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881,
  ],
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998,
  ],
};

function lab(hex: string, m: number[]): number[] {
  const lin = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = [0, 3, 6].map((k) =>
    Math.min(1, Math.max(0, m[k]! * lin[0]! + m[k + 1]! * lin[1]! + m[k + 2]! * lin[2]!)),
  ) as [number, number, number];
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** The smallest CIELAB distance between any two of the colours, under one kind of sight. */
export function minDistance(hexes: readonly string[], kind: keyof typeof SIM): number {
  let min = Infinity;
  hexes.forEach((a, i) =>
    hexes.slice(i + 1).forEach((b) => {
      const [p, q] = [lab(a, SIM[kind]), lab(b, SIM[kind])];
      min = Math.min(min, Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!));
    }),
  );
  return min;
}

function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe('named tokens of ticket 81', () => {
  const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
  const { light, dark } = readTokens(css);
  const themes = { light, dark };

  it('flags a mark under 3:1 (planted)', () => {
    const planted = { 'color-bad-fill': '#fca5a5', 'color-surface': '#ffffff' };
    expect(lines(planted, [['color-bad-fill', 'color-surface']], MARK_MIN)).toEqual([
      'color-bad-fill on color-surface: 1.90',
    ]);
  });

  for (const [name, tokens] of Object.entries(themes)) {
    it(`gives every status tone a fill, ink and tint in ${name}, and the old names follow`, () => {
      for (const [tone, old] of [
        ['good', 'ok'],
        ['watch', 'warning'],
        ['bad', 'danger'],
        ['neutral', 'muted'],
      ] as const)
        for (const [part, oldPart] of [
          ['fill', ''],
          ['ink', '-ink'],
          ['tint', '-tint'],
        ] as const)
          expect(colour(tokens, `color-${tone}-${part}`)).toBe(
            colour(tokens, `color-${old}${oldPart}`),
          );
    });

    it(`keeps every ink at 4.5:1 on its tint and the surface in ${name}`, () => {
      expect(lines(tokens, INK_PAIRS, MIN)).toEqual([]);
    });

    it(`keeps every status fill, family fill and chart series at 3:1 on the surface and the page in ${name}`, () => {
      expect(lines(tokens, marksOnGrounds, MARK_MIN)).toEqual([]);
    });

    it(`keeps the 8 series out of the red, green and info-blue bands in ${name}`, () => {
      for (const s of SERIES) {
        const h = hue(colour(tokens, s));
        expect(h >= 345 || h <= 50, `${s} ${h}`).toBe(false);
        expect(h >= 90 && h <= 160, `${s} ${h}`).toBe(false);
        expect(h >= 205 && h <= 235, `${s} ${h}`).toBe(false);
      }
    });

    it(`separates the 8 series by lightness as well as hue, for every kind of sight, in ${name}`, () => {
      const hexes = SERIES.map((s) => colour(tokens, s));
      expect(minDistance(hexes, 'normal')).toBeGreaterThanOrEqual(DISTANCE.normal);
      expect(minDistance(hexes, 'deuteranopia')).toBeGreaterThanOrEqual(DISTANCE.cvd);
      expect(minDistance(hexes, 'protanopia')).toBeGreaterThanOrEqual(DISTANCE.cvd);
      const lightness = hexes.map((h) => lab(h, SIM.normal)[0]!);
      expect(Math.max(...lightness) - Math.min(...lightness)).toBeGreaterThanOrEqual(30);
    });

    it(`ends the sequential ramp stronger than it starts and puts the diverging middle apart in ${name}`, () => {
      const rows = [CHART_VARS.seq, CHART_VARS.div].map((vars) =>
        vars.map((v) => lab(colour(tokens, v.slice(2)), SIM.normal)[0]!),
      );
      const [seq, div] = rows as [number[], number[]];
      const sign = name === 'light' ? -1 : 1;
      seq.slice(1).forEach((l, i) => expect(sign * (l - seq[i]!)).toBeGreaterThan(0));
      const mid = div[2]!;
      for (const end of [div[0]!, div[4]!]) expect(sign * (mid - end)).toBeLessThan(0);
    });

    it(`has chart-palette.ts agree with tokens.css in ${name}`, () => {
      const p = CHART_PALETTE[name as 'light' | 'dark'];
      for (const key of ['series', 'seq', 'div'] as const)
        expect(CHART_VARS[key].map((v) => colour(tokens, v.slice(2)))).toEqual([...p[key]]);
    });
  }

  it('names three depth levels, a size for every role and the chip radius', () => {
    for (const name of [
      'shadow-depth-0',
      'shadow-depth-1',
      'shadow-depth-2',
      'radius-card',
      'radius-control',
      'radius-chip',
      'spacing-chip',
    ])
      expect(light[name], name).toBeDefined();
    expect(dark['shadow-depth-1']).toBe('var(--shadow-card)');
  });
});

describe('family ramps (ticket 83c)', () => {
  const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
  const { light, dark } = readTokens(css);

  for (const [name, tokens] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    it(`reads 4.5:1 or better for its ink on every step of every family, in ${name}`, () => {
      const errors: string[] = [];
      for (const family of FAMILIES)
        for (const step of [1, 2, 3, 4, 5]) {
          const r = ratio(
            colour(tokens, `color-family-${family}-ramp-ink-${step}`),
            colour(tokens, `color-family-${family}-ramp-${step}`),
          );
          if (r < 4.5) errors.push(`${family} ${step}: ${r.toFixed(2)}`);
        }
      expect(errors).toEqual([]);
    });

    it(`runs each family's ramp from the surface toward its fill, nearer at every step, in ${name}`, () => {
      const dist = (a: string, b: string) =>
        Math.hypot(
          ...[1, 3, 5].map(
            (i) => parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16),
          ),
        );
      for (const family of FAMILIES) {
        const fill = colour(tokens, `color-family-${family}`);
        const away = [1, 2, 3, 4, 5].map((n) =>
          dist(colour(tokens, `color-family-${family}-ramp-${n}`), fill),
        );
        expect(away, family).toEqual([...away].sort((x, y) => y - x));
        expect(away[4], family).toBeLessThan(away[0]! / 5);
      }
    });
  }
});
