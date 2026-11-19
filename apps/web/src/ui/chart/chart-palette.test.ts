// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contrast, parseHex, type Rgb } from './chart-color.js';
import { FALLBACK_DARK, FALLBACK_LIGHT } from './chart-palette.js';

const TONES = ['#dc2626', '#2563eb', '#b45309', '#c2410c', '#7c3aed', '#15803d', '#6e6e73'];
// Slots 1 and 2 keep the chart tokens (accent teal and neutral grey).
const TOKENS = { light: ['#0f766e', '#6e6e73'], dark: ['#14b8a6', '#a1a1a6'] };

function hue([r, g, b]: Rgb): number {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return (h * 60 + 360) % 360;
}
const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// The chart surface of each theme (--color-surface light, the dark card), for the 3:1 non-text rule.
const SURFACE = { light: '#ffffff', dark: '#1c1c1e' };

describe.each([
  ['light', FALLBACK_LIGHT, TOKENS.light],
  ['dark', FALLBACK_DARK, TOKENS.dark],
] as const)('the %s fallback palette', (theme, fallback, tokens) => {
  it('reaches 3:1 against the theme surface, every colour', () => {
    for (const hex of fallback)
      expect(contrast(parseHex(hex)!, parseHex(SURFACE[theme])!)).toBeGreaterThanOrEqual(3);
  });
  const all = [...tokens, ...fallback].map((hex) => parseHex(hex)!);
  it('has eight colours, all different', () => {
    expect(all).toHaveLength(8);
    for (const [i, a] of all.entries())
      for (const b of all.slice(i + 1)) expect(distance(a, b)).toBeGreaterThan(60);
  });
  it('is none of the status tones and stays out of the red, green and info-blue hue bands', () => {
    for (const hex of fallback) {
      expect(TONES).not.toContain(hex);
      const h = hue(parseHex(hex)!);
      expect(h > 345 || h < 50).toBe(false);
      expect(h >= 90 && h <= 160).toBe(false);
      expect(h >= 205 && h <= 235).toBe(false);
    }
  });
});
