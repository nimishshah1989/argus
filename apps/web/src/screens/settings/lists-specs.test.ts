import { describe, expect, it } from 'vitest';
import type { ListItemReply } from '@uptimo/shared/plant-settings';
import type { CrudCtx } from '../../patterns/crud-spec.js';
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

describe('a list edit refreshes what the desk reads its labels from', () => {
  it('every list names the config among the keys a write invalidates', () => {
    for (const page of LIST_PAGES) expect(page.spec.invalidates, page.page).toContain('config');
  });
});

describe('the failure-code list (ticket 47)', () => {
  const failure = LIST_PAGES.find((page) => page.page === 'failure_code');

  it('is a generated page on the hub with its own title', () => {
    expect(failure).toBeDefined();
    expect(failure!.titleKey).toBe('lists.failureCode.title');
    expect(listMenu(LIST_PAGES).map((row) => row.to)).toContain(
      '/settings/lists?list=failure_code',
    );
  });

  it('shows the old codes there and hides them on every other list', () => {
    const fields = failure!.spec.fields.map((field) => field.name);
    expect(fields).toEqual(expect.arrayContaining(['label', 'code', 'sort', 'aliases']));
    expect(failure!.spec.hidden?.aliases).toBeUndefined();
    for (const page of LIST_PAGES.filter((it) => it.page !== 'failure_code'))
      expect(page.spec.hidden?.aliases, page.page).toBeTruthy();
  });

  it('reads a row as its label with the old codes under it', () => {
    const ctx = { lookups: {}, t: (key: string) => key } as unknown as CrudCtx;
    const row = {
      code: 'E',
      label: 'Electronics/Electrical',
      aliases: ['ele'],
      active: true,
    } as unknown as ListItemReply;
    expect(failure!.spec.look!(row, ctx)).toEqual({
      title: 'Electronics/Electrical',
      sub: 'ele',
    });
  });
});

describe('the lockout lists are on the same hub', () => {
  const page = (name: string) => LIST_PAGES.find((it) => it.page === name);

  it('offers breakdown categories with the lockout flag', () => {
    const breakdown = page('breakdown_category');
    expect(breakdown).toBeDefined();
    expect(breakdown!.spec.fields.map((field) => field.name)).toContain('needsLockout');
    expect(listMenu(LIST_PAGES).map((row) => row.to)).toContain(
      '/settings/lists?list=breakdown_category',
    );
  });

  it('offers the lockout steps as an ordinary editable list, label and code', () => {
    const steps = page('lockout_step');
    expect(steps).toBeDefined();
    const fields = steps!.spec.fields.map((field) => field.name);
    expect(fields).toEqual(expect.arrayContaining(['label', 'code', 'sort']));
    // The steps themselves are not one of the lists that carries the lockout flag.
    expect(fields).not.toContain('needsLockout');
    expect(listMenu(LIST_PAGES).map((row) => row.to)).toContain(
      '/settings/lists?list=lockout_step',
    );
  });
});
