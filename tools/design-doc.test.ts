import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const text = readFileSync(new URL('../docs/DESIGN.md', import.meta.url), 'utf8');
const [, frontMatter = '', body = ''] = text.split(/^---\s*$/m);

const SECTIONS = ['Overview', 'Colors', 'Typography', 'Layout'];

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

  it('names the five tones and the three density tiers', () => {
    for (const tone of ['critical', 'attention', 'good', 'info', 'neutral']) {
      expect(section('Colors'), tone).toMatch(new RegExp(`\\b${tone}\\b`, 'i'));
    }
    for (const tier of ['phone', 'laptop', 'TV']) {
      expect(section('Layout'), tier).toMatch(new RegExp(`\\b${tier}\\b`));
    }
  });

  it.each([
    ['Running is grey', /running[^.\n]{0,60}\bgrey\b/i],
    ['Waiting is amber', /waiting[^.\n]{0,60}\bamber\b/i],
    ['Transferred is blue', /transferred[^.\n]{0,60}\bblue\b/i],
    ['Indian grouping', /indian grouping/i],
    ['analytics follows the system theme', /analytics follows the device/i],
    ['the TV is always dark', /\bTV\b[^.\n]{0,80}always dark/i],
    ['the TV is 50 inch or larger', /50 inch or larger/i],
  ])('states the settled fact: %s', (_name, pattern) => {
    expect(text).toMatch(pattern);
  });
});
