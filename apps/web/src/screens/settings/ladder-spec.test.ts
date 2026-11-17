import { describe, expect, it } from 'vitest';
import type { CrudCtx } from '../../patterns/crud-spec.js';
import { ladderSpec } from './ladder-spec.js';

/**
 * D05: a settings screen is config against the shared reply schema, and a test fails when a schema key
 * is neither a form field nor listed as hidden. `id` and `active` are the row's identity and switch,
 * which the pattern itself reads, so every other key must be accounted for.
 */
const STRUCTURAL = new Set(['id', 'active']);
const ctx = { lookups: {}, t: (key: string) => key, timeZone: 'Asia/Kolkata' } as CrudCtx;

describe('the escalation ladder spec accounts for its reply keys (D05)', () => {
  it('every reply key is a field or declared hidden with a reason', () => {
    if (!ladderSpec.schema) throw new Error('the ladder has no reply schema to check');
    const fields = new Set(ladderSpec.fields.map((field) => field.name));
    const hidden = ladderSpec.hidden ?? {};
    const keys = Object.keys(ladderSpec.schema.shape);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      if (STRUCTURAL.has(key)) continue;
      expect(fields.has(key) || key in hidden, `ladder.${key} is neither field nor hidden`).toBe(
        true,
      );
      if (key in hidden) expect(hidden[key]!.trim(), `ladder.${key} has no reason`).not.toBe('');
    }
  });
});

describe('the ladder offers only the channels the server can send today', () => {
  it('the channel choices are exactly push', () => {
    const channel = ladderSpec.fields.find((field) => field.name === 'channel');
    if (!channel?.choices) throw new Error('the ladder has no channel field');
    expect(channel.choices(ctx).map((choice) => choice.value)).toEqual(['push']);
  });
});
