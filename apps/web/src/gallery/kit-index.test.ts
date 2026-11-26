import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KIT, KIT_GROUPS } from './kit-index.js';

const V2 = new URL('../ui/v2/', import.meta.url);
const kitDoc = readFileSync(new URL('../../../../docs/design/v2/KIT.md', import.meta.url), 'utf8');
const components = [
  ...readdirSync(V2).filter((f) => f.endsWith('.tsx')),
  ...readdirSync(new URL('domain/', V2))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => `domain/${f}`),
];

describe('the kit index and KIT.md list the whole v2 kit', () => {
  it('every component file in ui/v2 and ui/v2/domain is in the gallery index', () => {
    const listed = new Set(KIT.map((p) => p.file));
    expect(components.filter((f) => !listed.has(f))).toEqual([]);
  });

  it('every component file is in docs/design/v2/KIT.md', () => {
    expect(components.filter((f) => !kitDoc.includes(f.replace('domain/', '')))).toEqual([]);
  });

  it('every part sits in a known group', () => {
    const groups = new Set(KIT_GROUPS.map((g) => g.key));
    expect(KIT.filter((p) => !groups.has(p.group))).toEqual([]);
  });
});
