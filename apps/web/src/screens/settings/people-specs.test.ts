import { describe, expect, it } from 'vitest';
import { loginsSpec, peopleSpec } from './people-specs.js';

/**
 * D05: a settings screen is config against the shared reply schema, and a test fails when a schema key
 * is neither a form field nor listed as hidden. `id` and `active` are the row's identity and switch,
 * which the pattern itself reads, so every other key must be accounted for.
 */
const STRUCTURAL = new Set(['id', 'active']);

describe('every people and logins spec accounts for its reply keys (D05)', () => {
  const specs = [
    ['people', peopleSpec],
    ['logins', loginsSpec],
  ] as const;

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

describe('the people list shows what the plant knows (ticket 21)', () => {
  it('names the person, their team, cell, shift and login kind', () => {
    const ctx = {
      t: ((key: string, values?: Record<string, unknown>) =>
        values ? `${key}:${String(Object.values(values)[0])}` : key) as never,
      lookups: {
        logins: [
          { id: 'l1', personId: 'p1', role: 'technician', shared: false },
          { id: 'l2', personId: 'p1', role: 'supervisor', shared: true },
        ],
        shifts: [{ id: 's1', code: 'A', name: 'Shift A' }],
      },
    };
    const row = {
      id: 'p1',
      name: 'Asha',
      shortName: null,
      phone: null,
      team: 'maintenance' as const,
      title: 'Technician',
      cell: '4',
      defaultShift: 'A',
      active: true,
      pending: false,
    };
    const look = peopleSpec.look!(row, ctx);
    expect(look.title).toBe('Asha');
    expect(look.sub).toContain('Technician');
    const columnText = peopleSpec
      .columns!.map((column) => String(column.cell(row, ctx)))
      .join(' | ');
    expect(columnText).toContain('people.role.technician');
    expect(columnText).toContain('people.role.supervisor');
    expect(columnText).toContain('people.login.shared');
    expect(columnText).toContain('people.cellN:4');
    expect(columnText).toContain('people.shiftCode:A');
  });

  it('says a person has no login rather than leaving the cells empty', () => {
    const ctx = { t: ((key: string) => key) as never, lookups: { logins: [], shifts: [] } };
    const row = {
      id: 'p2',
      name: 'Omi',
      shortName: null,
      phone: null,
      team: 'production' as const,
      title: null,
      cell: null,
      defaultShift: null,
      active: true,
      pending: false,
    };
    const columnText = peopleSpec
      .columns!.map((column) => String(column.cell(row, ctx)))
      .join(' | ');
    expect(columnText).toContain('people.role.none');
    expect(columnText).toContain('people.cell.none');
    expect(columnText).toContain('people.shift.none');
  });
});

describe('the logins form asks for what a login holds (ticket 21)', () => {
  it('asks for a temporary password only when adding, and keeps username and person fixed', () => {
    const password = loginsSpec.fields.find((field) => field.name === 'temporaryPassword');
    expect(password?.requiredOnAdd).toBe(true);
    expect(loginsSpec.fields.find((field) => field.name === 'username')?.addOnly).toBe(true);
    expect(loginsSpec.fields.find((field) => field.name === 'shared')?.kind).toBe('choice');
    expect(loginsSpec.fields.find((field) => field.name === 'role')?.kind).toBe('choice');
  });
});
