import { describe, expect, it } from 'vitest';
import { countedText, printedNumber, stakeText } from './team-focus-actions.js';

describe('Team Focus figures', () => {
  it('prints the hours at stake as the engine gave them, at least one decimal', () => {
    expect(stakeText(6.09)).toBe('6.09');
    expect(stakeText(5.1)).toBe('5.1');
    expect(stakeText(10)).toBe('10.0');
    expect(stakeText(12345.5)).toBe('12,345.5');
    expect(stakeText(123456.5)).toBe('1,23,456.5');
  });

  it('finds the number the engine printed in a count, a percentage or an amount of hours', () => {
    expect(printedNumber('31')).toBe(31);
    expect(printedNumber('0%')).toBe(0);
    expect(printedNumber('1,343 hrs')).toBe(1343);
    expect(printedNumber('2,145.5 hrs')).toBe(2145.5);
    expect(printedNumber('—')).toBeNull();
    expect(printedNumber('')).toBeNull();
  });

  it('counts up inside the engine text and lands on that text exactly', () => {
    expect(countedText('31', 12)).toBe('12');
    expect(countedText('42.5%', 10)).toBe('10.0%');
    expect(countedText('2,145.5 hrs', 1200.25)).toBe('1,200.3 hrs');
    expect(countedText('31', 31)).toBe('31');
    expect(countedText('2,145.5 hrs', 2145.5)).toBe('2,145.5 hrs');
    expect(countedText('—', 5)).toBe('—');
  });
});
