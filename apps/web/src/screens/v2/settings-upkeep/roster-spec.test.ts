import { describe, expect, it } from 'vitest';
import { rosterSpec } from './roster-spec.js';

/**
 * D05: a settings screen is config against the shared reply schema, and a test fails when a schema key
 * is neither a form field nor listed as hidden. `id` and `active` are the row's identity and switch,
 * which the pattern itself reads, so every other key must be accounted for.
 */
const STRUCTURAL = new Set(['id', 'active']);

describe('the duty roster spec accounts for its reply keys (D05)', () => {
  it('every reply key is a field or declared hidden with a reason', () => {
    if (!rosterSpec.schema) throw new Error('the roster has no reply schema to check');
    const fields = new Set(rosterSpec.fields.map((field) => field.name));
    const hidden = rosterSpec.hidden ?? {};
    const keys = Object.keys(rosterSpec.schema.shape);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      if (STRUCTURAL.has(key)) continue;
      expect(fields.has(key) || key in hidden, `roster.${key} is neither field nor hidden`).toBe(
        true,
      );
      if (key in hidden) expect(hidden[key]!.trim(), `roster.${key} has no reason`).not.toBe('');
    }
  });
});
