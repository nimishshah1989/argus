// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');

describe('S26-6 lists hub: loading, failure and the table title', () => {
  it('"All entries" keeps its title (no headed table)', () => {
    expect(source('./View.tsx')).not.toMatch(/\bheaded\b/);
  });

  it('the hub reads listsHub and shows the kit error and offline states', () => {
    const view = source('./View.tsx');
    expect(view).toMatch(/listsHub\(/);
    expect(view).toMatch(/<ErrorState\b/);
    expect(view).toMatch(/<OfflineState\b/);
  });

  it('no comment claims money keys are absent from the reply', () => {
    for (const name of ['./model.ts', './analytics-profile-spec.tsx']) {
      expect(source(name), name).not.toMatch(/money rights/i);
    }
  });
});
