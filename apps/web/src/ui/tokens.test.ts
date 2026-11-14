import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Contrast guard for the tokens (design lock, 14 Nov 2026). Every status ink must reach 4.5:1 on its own
 * tint, in light and in dark; the accent must read as text and carry its own text as a fill. The kit's old
 * tone colours failed on their tints (Stopped 4.23, In progress 4.48, Support 4.45, Fixed 4.42, Closed 4.30).
 */

const TONES = ['danger', 'info', 'warning', 'hold', 'moved', 'ok', 'muted'];
const MIN = 4.5;

type Tokens = Record<string, string>;

function declarations(block: string): Tokens {
  const out: Tokens = {};
  for (const m of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

/** The light tokens are the `@theme` block; dark is `:root[data-theme='dark']` laid over them. */
export function readTokens(css: string): { light: Tokens; dark: Tokens } {
  const light = declarations(/@theme\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '');
  const dark = declarations(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '');
  return { light, dark: { ...light, ...dark } };
}

function colour(tokens: Tokens, name: string): string {
  let value = tokens[name];
  for (let hops = 0; value?.startsWith('var(') && hops < 4; hops++)
    value = tokens[value.slice(6, -1)];
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${name} is not a hex colour`);
  return value;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Every text pair the lock promises, as `[text, background]` token names. */
const PAIRS: [string, string][] = [
  ...TONES.map((t): [string, string] => [`color-${t}-ink`, `color-${t}-tint`]),
  ['color-accent-ink', 'color-accent'],
  ['color-accent-text', 'color-surface'],
  ['color-accent-text', 'color-accent-tint'],
  ['color-neutral-900', 'color-surface'],
  ['color-neutral-600', 'color-surface'],
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

  it('gives dark its own accent: #14b8a6 with dark text, #0f766e stays in light', () => {
    expect(colour(light, 'color-accent')).toBe('#0f766e');
    expect(colour(dark, 'color-accent')).toBe('#14b8a6');
    expect(ratio(colour(dark, 'color-accent-ink'), colour(dark, 'color-accent'))).toBeGreaterThan(
      6.8,
    );
  });
});
