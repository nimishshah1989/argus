import { describe, expect, it } from 'vitest';
import { LIST_PAGES, glossarySpec, listMenu } from './lists-specs.js';

/**
 * D05: a settings screen is config against the shared reply schema, and a test fails when a schema key
 * is neither a form field nor listed as hidden. `id` and `active` are the row's identity and switch,
 * which the pattern itself reads, so every other key must be accounted for.
 */
const STRUCTURAL = new Set(['id', 'active']);

describe('every list settings spec accounts for its reply keys (D05)', () => {
  const specs = [
    ...LIST_PAGES.map((p) => [p.page, p.spec] as const),
    ['glossary', glossarySpec] as const,
  ];

  for (const [page, spec] of specs) {
    it(`${page}: every reply key is a field or declared hidden with a reason`, () => {
      if (!spec.schema) throw new Error(`${page} has no reply schema to check`);
      const fields = new Set<string>(spec.fields.map((field) => field.name));
      const hidden = spec.hidden ?? {};
      const keys = Object.keys(spec.schema.shape);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        if (STRUCTURAL.has(key)) continue;
        expect(fields.has(key) || key in hidden, `${page}.${key} is neither field nor hidden`).toBe(
          true,
        );
        if (key in hidden) expect(hidden[key]!.trim(), `${page}.${key} has no reason`).not.toBe('');
      }
    });
  }
});

describe('the lists screen is grown from its page config', () => {
  it('gives every configured list a row on the hub', () => {
    const rows = listMenu(LIST_PAGES);
    expect(rows).toHaveLength(LIST_PAGES.length);
    expect(rows.map((row) => row.titleKey)).toEqual(LIST_PAGES.map((page) => page.titleKey));
  });

  it('shows a list added to the config, with no other screen code', () => {
    const extra = {
      page: 'task_reason',
      titleKey: 'lists.flag.yes',
      subKey: 'lists.flag.no',
    } as const;
    const rows = listMenu([...LIST_PAGES, extra]);
    expect(rows.map((row) => row.to)).toContain('/settings/lists?list=task_reason');
    expect(rows.at(-1)?.titleKey).toBe('lists.flag.yes');
  });
});
