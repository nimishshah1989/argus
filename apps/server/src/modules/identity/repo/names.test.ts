import { describe, expect, it } from 'vitest';
import { nameCodes, textPlaceholder } from './names.js';

const names = new Map([
  ['P-3f412b54', 'Ramesh Patel'],
  ['P-0a1b2c3d', 'Sunita Rao'],
]);

describe('nameCodes', () => {
  it('swaps every known code in every string, deep, and leaves keys, numbers and non-plain values alone', () => {
    const when = new Date(0);
    const reply = {
      doneBy: 'P-3f412b54, P-0a1b2c3d',
      labels: ['P-0a1b2c3d', 'Maint. Team'],
      'P-3f412b54': { hours: 2, team: 'P-3f412b54 Team' },
      when,
      none: null,
    };
    expect(nameCodes(reply, names)).toEqual({
      doneBy: 'Ramesh Patel, Sunita Rao',
      labels: ['Sunita Rao', 'Maint. Team'],
      'P-3f412b54': { hours: 2, team: 'Ramesh Patel Team' },
      when,
      none: null,
    });
    expect(nameCodes(reply, names).when).toBe(when);
  });

  it('keeps a code with no name (erased or unknown), and never touches a longer token', () => {
    expect(nameCodes('P-ffffffff, P-3f412b54', names)).toBe('P-ffffffff, Ramesh Patel');
    expect(nameCodes('XP-3f412b54 P-3f412b549', names)).toBe('XP-3f412b54 P-3f412b549');
  });

  it('turns a named person in redacted free text back into the bare name, and leaves an erased one a placeholder', () => {
    const ramesh = textPlaceholder('P-3f412b54');
    const leaver = textPlaceholder('P-ffffffff');
    expect(ramesh).toBe('[P-16193:11092]');
    expect(textPlaceholder('P-0a1b2c3d')).toBe('[P-2587:11325]');
    const reply = {
      problem: `Spindle noise, told ${ramesh}`,
      rootCause: `${leaver} left it loose`,
    };
    expect(nameCodes(reply, names)).toEqual({
      problem: 'Spindle noise, told Ramesh Patel',
      rootCause: '[P-65535:65535] left it loose',
    });
    // The AI's per-text placeholders map to no one and stay as they are.
    expect(nameCodes('told [P1] and [P2], [PHONE]', names)).toBe('told [P1] and [P2], [PHONE]');
  });
});
