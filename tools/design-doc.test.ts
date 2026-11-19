import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const text = readFileSync(new URL('../docs/DESIGN.md', import.meta.url), 'utf8');
const [, frontMatter = '', body = ''] = text.split(/^---\s*$/m);

const SECTIONS = ['Overview', 'Colors', 'Typography', 'Layout'];
const NEUTRAL_ROLES = ['page', 'surface', 'surface-2', 'line', 'control', 'ink', 'ink-2'];
const ACCENT_ROLES = ['accent', 'on-accent', 'accent-tint'];
const SERIES = Array.from({ length: 8 }, (_, i) => `series-${i + 1}`);
const RAMPS = ['seq', 'div'];
const TEMPLATES = ['overview', 'analysis', 'register', 'entity', 'work queue'];
const has = (haystack: string, name: string): boolean =>
  new RegExp(`(?<![\\w-])${name.replace(/ /g, '\\s+')}(?![\\w-])`, 'i').test(haystack);

function section(name: string): string {
  const start = body.search(new RegExp(`^## ${name}\\s*$`, 'm'));
  if (start < 0) return '';
  const rest = body.slice(start + 1);
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}

describe('docs/DESIGN.md', () => {
  it('opens with front matter that parses and names the token groups', () => {
    const tokens = parse(frontMatter) as Record<string, unknown>;
    for (const key of ['name', 'colors', 'typography', 'rounded', 'spacing', 'components']) {
      expect(tokens, key).toHaveProperty(key);
    }
  });

  it('has sections 1 to 4 in impeccable order, each with content', () => {
    const found = [...body.matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1]);
    expect(found.slice(0, SECTIONS.length)).toEqual(SECTIONS);
    for (const name of SECTIONS) expect(section(name).trim().length, name).toBeGreaterThan(200);
  });

  it('defines every colour role, 8 series, 2 ramps and 5 templates', () => {
    const colours = (parse(frontMatter) as { colors: Record<string, string> }).colors;
    for (const role of [...NEUTRAL_ROLES, ...ACCENT_ROLES]) {
      expect(colours, role).toHaveProperty([role]);
      expect(has(section('Colors'), role), `${role} in Colors`).toBe(true);
    }
    for (const name of [...SERIES, ...RAMPS]) {
      expect(has(section('Colors'), name), name).toBe(true);
    }
    const layout = section('Layout');
    expect(layout).toMatch(/^### Templates\s*$/m);
    for (const template of TEMPLATES) expect(has(layout, template), template).toBe(true);
  });

  it('names the five tones and the three density tiers', () => {
    for (const tone of ['critical', 'attention', 'good', 'info', 'neutral']) {
      expect(section('Colors'), tone).toMatch(new RegExp(`\\b${tone}\\b`, 'i'));
    }
    for (const tier of ['phone', 'laptop', 'TV']) {
      expect(section('Layout'), tier).toMatch(new RegExp(`\\b${tier}\\b`));
    }
  });

  it.each([
    ['Running is grey', /\brunning\s+(?:is|stays|reads)\s+grey\b/i],
    ['Waiting is amber', /\bwaiting\s+(?:is|stays|reads)\s+amber\b/i],
    ['Transferred is blue', /\btransferred\s+(?:is|stays|reads)\s+blue\b/i],
    ['numbers use Indian grouping', /\bnumbers\s+use\s+indian grouping/i],
    [
      'analytics follows the system theme',
      /analytics follows the (?:device|system)(?:'s)?\s+(?:light or dark\s+)?(?:setting|theme)/i,
    ],
    ['the TV is always dark', /\bTV(?: board)?\s+(?:is|stays)\s+always dark/i],
    ['the TV is 50 inch or larger', /\bTV\s+is\s+50 inch or larger/i],
  ])('states the settled fact: %s', (_name, pattern) => {
    expect(text.replace(/\s+/g, ' ')).toMatch(pattern);
  });
});
