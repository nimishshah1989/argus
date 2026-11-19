import { describe, expect, it } from 'vitest';
import { instrument } from '../directions/direction-instrument.js';
import { inkOn } from '../directions/parts-palette.js';
import { rampOf } from './heat-map.js';

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
    it('the four identity colours are 3:1 on the card as marks and 4.5:1 as text', () => {
      const families = [
        [p['good-fill'], p['good-ink']],
        [p['attention-fill'], p['attention-ink']],
        [p['info-fill'], p['info-ink']],
        [p.accent, p.accent],
      ] as const;
      for (const [fill, ink] of families) {
        expect(ratio(fill, p.surface)).toBeGreaterThanOrEqual(3);
        expect(ratio(ink, p.surface)).toBeGreaterThanOrEqual(4.5);
      }
    });
    it('every heat square prints its hours at 4.5:1 or better', () => {
      for (const step of rampOf(theme)) {
        expect(ratio(step, inkOn(step))).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
}
