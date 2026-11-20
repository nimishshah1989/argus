import { describe, expect, it } from 'vitest';
import { fill } from './fill.js';

describe('fill', () => {
  it('puts every value into its place, as often as it appears', () => {
    expect(fill('{n} of {total} decided; {n} done', { n: 1, total: 4 })).toBe(
      '1 of 4 decided; 1 done',
    );
  });

  it('leaves a name with no value as written', () => {
    expect(fill('{n} down in {cell}', { n: 2 })).toBe('2 down in {cell}');
  });

  it('never reads a name off the object prototype', () => {
    expect(fill('{constructor}', {})).toBe('{constructor}');
  });
});
