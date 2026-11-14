import { describe, expect, it } from 'vitest';
import { personMinutes } from '../src/person-minutes.js';
import type { WorkSegment } from '../src/types.js';

const t = (iso: string) => new Date(iso);
const seg = (personId: string, from: string, to?: string): WorkSegment => ({
  personId,
  role: 'lead',
  startedAt: t(from),
  ...(to ? { endedAt: t(to) } : {}),
});

describe('personMinutes', () => {
  const now = t('2026-01-01T12:00:00Z');

  it('rounds each segment to whole minutes, then adds them per person', () => {
    // two stretches of 10 min 29 s: 20 as rounded stretches, but 21 if the seconds were added first
    const segments = [
      seg('a', '2026-01-01T10:00:00Z', '2026-01-01T10:10:29Z'),
      seg('a', '2026-01-01T11:00:00Z', '2026-01-01T11:10:29Z'),
    ];
    expect(personMinutes(segments, now)).toEqual({ a: 20 });
  });

  it('runs an open segment to now', () => {
    expect(personMinutes([seg('a', '2026-01-01T11:00:00Z')], now)).toEqual({ a: 60 });
  });

  it('counts only the part inside a window, each segment rounded after it is clipped', () => {
    const window = { start: t('2026-01-01T10:00:00Z'), end: t('2026-01-01T11:00:00Z') };
    const segments = [
      seg('a', '2026-01-01T09:30:00Z', '2026-01-01T10:20:00Z'), // 20 inside
      seg('a', '2026-01-01T10:50:00Z', '2026-01-01T11:40:00Z'), // 10 inside
      seg('b', '2026-01-01T11:30:00Z', '2026-01-01T11:50:00Z'), // outside
    ];
    expect(personMinutes(segments, now, window)).toEqual({ a: 30 });
  });

  it('lists a person with a stretch too short to count as 0, and leaves out a stretch that has not started', () => {
    expect(personMinutes([seg('a', '2026-01-01T11:00:00Z', '2026-01-01T11:00:10Z')], now)).toEqual({
      a: 0,
    });
    expect(personMinutes([seg('a', '2026-01-01T12:30:00Z')], now)).toEqual({});
  });
});
