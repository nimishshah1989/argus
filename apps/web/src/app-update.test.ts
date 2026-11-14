import { describe, expect, it } from 'vitest';
import type { Shift } from './api.js';
import { inChangeover } from './app-update.js';

const shift = (code: string, starts_at: string, ends_at: string, crosses_midnight: boolean) =>
  ({ id: code, code, name: `Shift ${code}`, starts_at, ends_at, crosses_midnight }) as Shift;
const SHIFTS = [shift('1', '08:00', '18:30', false), shift('2', '18:29', '05:00', true)];
const IST = 'Asia/Kolkata';
/** A plant-local clock time on 14 Nov 2026 (IST is UTC+5:30) as the instant the browser sees. */
const at = (hhmm: string) => new Date(`2026-11-14T${hhmm}:00+05:30`);

describe('inChangeover', () => {
  it('is true within 15 minutes either side of a shift start or end, in the plant time zone', () => {
    expect(inChangeover(at('07:50'), SHIFTS, IST)).toBe(true);
    expect(inChangeover(at('08:10'), SHIFTS, IST)).toBe(true);
    expect(inChangeover(at('18:40'), SHIFTS, IST)).toBe(true);
    expect(inChangeover(at('04:55'), SHIFTS, IST)).toBe(true);
  });

  it('is false in the middle of a shift', () => {
    expect(inChangeover(at('12:00'), SHIFTS, IST)).toBe(false);
    expect(inChangeover(at('22:00'), SHIFTS, IST)).toBe(false);
  });

  it('reads the clock in the plant time zone, not the browser time zone', () => {
    // 07:55 in Kolkata is 02:25 UTC: a phone set to UTC must still see a changeover.
    expect(inChangeover(new Date('2026-11-14T02:25:00Z'), SHIFTS, IST)).toBe(true);
  });

  it('wraps past midnight', () => {
    const night = [shift('N', '23:55', '00:05', true)];
    expect(inChangeover(at('00:10'), night, IST)).toBe(true);
    expect(inChangeover(at('23:45'), night, IST)).toBe(true);
    expect(inChangeover(at('03:00'), night, IST)).toBe(false);
  });

  it('is false with no shifts configured', () => {
    expect(inChangeover(at('08:00'), [], IST)).toBe(false);
  });
});
