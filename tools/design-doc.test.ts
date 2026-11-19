import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const text = readFileSync(new URL('../docs/DESIGN.md', import.meta.url), 'utf8');
const [, frontMatter = '', body = ''] = text.split(/^---\s*$/m);

const SECTIONS = ['Overview', 'Colors', 'Typography', 'Layout'];
const LATER = ['Elevation & Depth', 'Shapes', 'Components', "Do's and Don'ts"];
const ELEMENTS = [
  'KPI tile',
  'status chip',
  'sparkline',
  'trend delta',
  'heat grid',
  'ranked list',
  'timeline',
  'insight banner',
  'data table',
  'period picker',
  'grouped navigation',
  'drill trail',
];
const NEUTRAL_ROLES = ['page', 'surface', 'surface-2', 'line', 'control', 'ink', 'ink-2'];
const ACCENT_ROLES = ['accent', 'on-accent', 'accent-tint'];
const SERIES = Array.from({ length: 8 }, (_, i) => `series-${i + 1}`);
const RAMPS = ['seq', 'div'];
const TEMPLATES = ['overview', 'analysis', 'register', 'entity', 'work queue'];
const HEDGE =
  /\b(?:not|never|no longer|unless|may|might|maybe|perhaps|could|if|until|yet|cannot|except)\b|n't\b/i;

/** Sentences of a markdown text: a blank line, a list item, a table row or a heading ends one. */
function sentences(markdown: string): string[] {
  return markdown
    .split(/\n\s*\n|\n(?=\s*(?:[-*]\s|\d+\.\s|\||#))/)
    .flatMap((block) =>
      block
        .replace(/[*`]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(/(?<=[.!?])\s+/),
    )
    .filter(Boolean);
}

/** A fact is stated when every sentence that holds it is positive, and at least one does. */
function states(doc: string, pattern: RegExp): boolean {
  const holding = sentences(doc).filter((sentence) => pattern.test(sentence));
  return holding.length > 0 && holding.every((sentence) => !HEDGE.test(sentence));
}
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

  it('has sections 5 to 8 after them, answers what the slice asks, and TAG-SYSTEM points here', () => {
    const found = [...body.matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1]);
    expect(found.slice(SECTIONS.length)).toEqual(LATER);
    for (const name of LATER) expect(section(name).trim().length, name).toBeGreaterThan(200);
    const depth = section('Elevation & Depth');
    for (const level of ['level 0', 'level 1', 'level 2'])
      expect(has(depth, level), level).toBe(true);
    const shapes = section('Shapes');
    for (const role of ['control', 'card', 'sheet', 'chip', 'tile', 'focus ring']) {
      expect(has(shapes, role), role).toBe(true);
    }
    const components = section('Components');
    for (const element of ELEMENTS) expect(has(components, element), element).toBe(true);
    for (const heading of ['Empty, loading and error', 'Charts', 'Icons', 'Motion', 'Numbers']) {
      expect(components, heading).toMatch(new RegExp(`^### ${heading}\\s*$`, 'm'));
    }
    for (const fact of ['150 ms', '250 ms', '300 ms', 'reduced motion']) {
      expect(has(components, fact), fact).toBe(true);
    }
    expect(section("Do's and Don'ts")).toMatch(/^### Don't\s*$/m);
    expect(text).not.toMatch(/sections? 5 to 8 (?:are|follow)/i);
    const tagSystem = readFileSync(
      new URL('../docs/design/TAG-SYSTEM.md', import.meta.url),
      'utf8',
    );
    expect(tagSystem).toContain('docs/DESIGN.md');
  });

  it('says where the 9999 px chip radius is defined, and that LOCK.md only says round', () => {
    const all = sentences(body);
    expect(all.some((s) => /9999 px/.test(s) && /defined in this document/.test(s))).toBe(true);
    expect(all.some((s) => /LOCK\.md/.test(s) && /only/.test(s) && /round/.test(s))).toBe(true);
    expect(all.filter((s) => /9999 px/.test(s) && /come from .*LOCK\.md/.test(s))).toEqual([]);
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
    expect(states(body, pattern)).toBe(true);
  });
});

describe('a settled fact must be its own positive sentence', () => {
  const running = /\brunning\s+is\s+grey\b/i;

  it('accepts the fact as a sentence, in prose, a bullet or a wrapped line', () => {
    expect(states('Stopped stands out. Running is grey. Waiting is amber.', running)).toBe(true);
    expect(states('- **Running is grey.** Stopped and waiting stand out.', running)).toBe(true);
    expect(states('Running\nis grey.', running)).toBe(true);
  });

  it('accepts the fact when a qualifier sits in a different sentence', () => {
    expect(states('Running is grey. The TV distance is not known yet.', running)).toBe(true);
    expect(states('- Running is grey.\n- The pick may change the tone values.', running)).toBe(
      true,
    );
  });

  it.each([
    'It is not true that Running is grey.',
    'Running is grey unless the pick says otherwise.',
    'Running is grey, though that may change.',
    'Running is grey for now if the pick keeps it.',
    'Running is grey and never green. Running is no longer grey.',
    'Running is grey, not yet confirmed.',
    'Running is grey. Later: it is not true that Running is grey.',
  ])('rejects a negated or qualified statement: %s', (sample) => {
    expect(states(sample, running)).toBe(false);
  });

  it('rejects a fact that is missing', () => {
    expect(states('Stopped is red.', running)).toBe(false);
  });
});
