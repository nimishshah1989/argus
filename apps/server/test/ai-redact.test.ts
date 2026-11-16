import { describe, expect, it } from 'vitest';
import type { RedactionTerms } from '../src/modules/identity/index.js';
import { createRedactor } from '../src/modules/identity/redact.js';

function terms(over: Partial<RedactionTerms> = {}): RedactionTerms {
  return {
    names: ['Ravi Fake', 'Mina Fake'],
    shortNames: ['Ravi'],
    phones: ['+919000000101', '+919000000102'],
    usernames: ['ravi.f', 'old.user'],
    tenantName: 'Test Plant A',
    ...over,
  };
}

describe('createRedactor', () => {
  it('removes a name in any letter case and a phone in any spacing', () => {
    const redactor = createRedactor(terms({ names: ['Ravi Fake'], phones: ['+919000000101'] }));
    const out = redactor.redact({
      problem: 'ravi fake called from 90000 00101 and +91-90000-00101',
    }) as { problem: string };
    expect(out.problem).not.toMatch(/ravi fake/i);
    for (const run of ['+91', '90000', '00101']) expect(out.problem).not.toContain(run);
    expect(out.problem).toContain('[P1]');
    expect(out.problem).toContain('[PHONE]');
  });

  it('removes a Gujarati-script name but not the same letters inside a longer word', () => {
    const first = createRedactor(terms({ names: ['રવિ'], shortNames: [] }));
    expect(first.redact('રવિ એ ફોન કર્યો; રવિવાર')).toBe('[P1] એ ફોન કર્યો; રવિવાર');
    const second = createRedactor(terms({ names: ['રવ'], shortNames: [] }));
    expect(second.redact('રવિ')).toBe('રવિ');
  });

  it('replaces the longest term first', () => {
    const redactor = createRedactor(terms({ names: ['Asha Fake'], shortNames: ['Asha'] }));
    expect(redactor.redact('Asha Fake and Asha')).toBe('[P1] and [P2]');
  });

  it('replaces short names, usernames and the plant name', () => {
    const redactor = createRedactor(terms());
    const out = redactor.redact('Ravi and ravi.f at Test Plant A') as string;
    expect(out).not.toContain('Ravi');
    expect(out).not.toContain('ravi.f');
    expect(out).not.toContain('Test Plant A');
    expect(out).toContain('[PLANT]');
  });

  it('redacts every string leaf of nested input and leaves numbers alone', () => {
    const redactor = createRedactor(terms());
    expect(redactor.redact({ a: ['Ravi Fake'], b: { c: 'Ravi Fake' }, n: 42 })).toEqual({
      a: ['[P1]'],
      b: { c: '[P1]' },
      n: 42,
    });
  });

  it('detects a surviving term or phone and passes a clean prompt', () => {
    const redactor = createRedactor(terms());
    expect(redactor.leaks('call Ravi Fake')).toBe(true);
    expect(redactor.leaks('call 9000000101')).toBe(true);
    const clean = redactor.redact('Ravi Fake called from +919000000101 at Test Plant A') as string;
    expect(redactor.leaks(clean)).toBe(false);
  });

  it('ignores one-character terms and exposes no map', () => {
    const redactor = createRedactor(terms({ names: [], shortNames: ['R'], usernames: [] }));
    expect(redactor.redact('R pump')).toBe('R pump');
    expect(redactor.leaks('R pump')).toBe(false);
    expect(Object.keys(redactor)).toEqual(['redact', 'leaks']);
  });
});
