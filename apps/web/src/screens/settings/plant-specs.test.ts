import { describe, expect, it } from 'vitest';
import { groupsSpec, machinesSpec, shiftsSpec } from './plant-specs.js';

/**
 * D05: a settings screen is config against the shared reply schema, and a test fails when a schema key
 * is neither a form field nor listed as hidden. `id` and `active` are the row's identity and switch,
 * which the pattern itself reads, so every other key must be accounted for.
 */
const STRUCTURAL = new Set(['id', 'active']);

describe('every plant settings spec accounts for its reply keys (D05)', () => {
  const specs = [
    ['machines', machinesSpec],
    ['groups', groupsSpec],
    ['shifts', shiftsSpec],
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
