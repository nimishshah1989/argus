import { describe, expect, it } from 'vitest';
import { createPeople } from './legacy-people.js';

describe('legacy people redaction', () => {
  it('redacts a phone number that sits inside a longer run of digit groups', () => {
    const people = createPeople([], [], ['Zorbo Quixle']);
    const text = 'call 98765 43210 12 34 56 78 90 now';
    const out = people.redact(text);
    expect(out).not.toContain('98765');
    expect(out).not.toContain('43210');
    expect(out).toContain('[phone]');
    expect(people.phoneLeaks(text)).toBe(1);
    expect(people.phoneLeaks(out)).toBe(0);
  });

  it('leaves a short digit run and a date alone', () => {
    const people = createPeople([], [], ['Zorbo Quixle']);
    expect(people.redact('on 03-11-2022 shift 12 34')).toBe('on 03-11-2022 shift 12 34');
  });

  it('redacts an ordinary word when it is part of an observed name, and keeps it otherwise', () => {
    const named = createPeople([], [], ['Zorbo It']);
    expect(named.redact('Zorbo said it works')).toBe('[person] said [person] works');
    const plain = createPeople([], [], ['Zorbo Quixle']);
    expect(plain.redact('Zorbo said it works')).toBe('[person] said it works');
  });
});
