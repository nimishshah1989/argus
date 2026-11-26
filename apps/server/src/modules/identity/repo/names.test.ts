import { describe, expect, it } from 'vitest';
import { nameCodes } from './names.js';

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
});
