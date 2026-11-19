import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { instrument } from '../directions/direction-instrument.js';
import { FAMILY_COLOURS } from '../directions/family-colours.js';
import { FULL, PARTIAL, metricOf } from './data.js';
import { rangeTag } from './tags.js';
import type { TFunction } from 'i18next';

const lum = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const hue = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const hueGap = (a: string, b: string): number => {
  const gap = Math.abs(hue(a) - hue(b));
  return Math.min(gap, 360 - gap);
};

const TONES = ['good', 'attention', 'critical', 'info', 'neutral'] as const;

for (const theme of ['light', 'dark'] as const) {
  const p = instrument[theme];
  describe(`showcase colour contrast, ${theme}`, () => {
    it.each(TONES)('a %s tag: its ink on its soft tint is 4.5:1 or better', (tone) => {
      expect(ratio(p[`${tone}-ink`], p[`${tone}-tint`])).toBeGreaterThanOrEqual(4.5);
    });
    it.each(TONES)('a %s tag: its ink on the card is 4.5:1 or better', (tone) => {
      expect(ratio(p[`${tone}-ink`], p.surface)).toBeGreaterThanOrEqual(4.5);
    });
    it('the four identity colours are 3:1 on the card as marks, and 4.5:1 as text on it and on their tint', () => {
      const f = FAMILY_COLOURS[theme];
      const families = [
        [f.availability.fill, f.availability.ink, f.availability.tint],
        [f.downtime.fill, f.downtime.ink, f.downtime.tint],
        [p['info-fill'], p['info-ink'], p['info-tint']],
        [p.accent, p.accent, p['accent-tint']],
      ] as const;
      for (const [fill, ink, tint] of families) {
        expect(ratio(fill, p.surface)).toBeGreaterThanOrEqual(3);
        expect(ratio(ink, p.surface)).toBeGreaterThanOrEqual(4.5);
        expect(ratio(ink, tint)).toBeGreaterThanOrEqual(4.5);
      }
    });
    it('an identity hue is never a verdict hue: availability and downtime keep clear of good, watch and bad', () => {
      const f = FAMILY_COLOURS[theme];
      const verdicts = [p['good-fill'], p['attention-fill'], p['critical-fill']];
      for (const family of [f.availability.fill, f.downtime.fill]) {
        for (const verdict of verdicts) {
          expect(family).not.toBe(verdict);
          expect(hueGap(family, verdict)).toBeGreaterThanOrEqual(10);
        }
      }
    });
    it('every heat square prints its hours at 4.5:1 or better (the shared downtime ramp)', () => {
      const css = readFileSync(new URL('../../ui/tokens.css', import.meta.url), 'utf8');
      const dark = css.indexOf(":root[data-theme='dark']");
      const part = theme === 'light' ? css.slice(0, dark) : css.slice(dark);
      const hex = (name: string): string =>
        new RegExp(`--color-${name}: (#[0-9a-f]{6});`).exec(css)![1]!;
      const ink = (step: number): string => {
        const given = new RegExp(
          `--color-family-downtime-ramp-ink-${step}: var\\(--color-([a-z-]+)\\);`,
        ).exec(part)?.[1];
        return hex(given ?? `ramp-ink-dark`);
      };
      for (const step of [1, 2, 3, 4, 5]) {
        const square = new RegExp(`--color-family-downtime-ramp-${step}: (#[0-9a-f]{6});`).exec(
          part,
        )![1]!;
        expect(ratio(square, ink(step))).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
}

describe('ui/tokens.css holds the same identity colours as the gallery constants', () => {
  const css = readFileSync(new URL('../../ui/tokens.css', import.meta.url), 'utf8');
  const dark = css.indexOf(":root[data-theme='dark']");
  const read = (from: string, name: string): string =>
    new RegExp(`--color-family-${name}: (#[0-9a-f]{6});`).exec(from)![1]!;
  it.each(['light', 'dark'] as const)('in %s', (theme) => {
    const part = theme === 'light' ? css.slice(0, dark) : css.slice(dark);
    for (const family of ['availability', 'downtime'] as const) {
      const c = FAMILY_COLOURS[theme][family];
      expect(read(part, family)).toBe(c.fill);
      expect(read(part, `${family}-ink`)).toBe(c.ink);
      expect(read(part, `${family}-tint`)).toBe(c.tint);
    }
  });
});

describe('a running month is not set against the usual range', () => {
  const t = ((key: string) => key) as unknown as TFunction;
  it('never tags a partial summed month (downtime, breakdowns, planned work) as below usual', () => {
    expect(PARTIAL).toBe(true);
    for (const id of ['downtime', 'breakdowns', 'pm'] as const) {
      expect(rangeTag(t, metricOf(id), FULL)).toBeNull();
    }
  });
  it('still tags a partial rate (availability), which a part month can be compared on', () => {
    expect(rangeTag(t, metricOf('availability'), FULL)).not.toBeNull();
  });
});
