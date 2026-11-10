import { describe, expect, it } from 'vitest';
import { figures } from '../src/figures.js';
import type { FigureInput, TicketEvent, WorkSegment } from '../src/types.js';

const t = (iso: string) => new Date(iso);

function seg(
  personId: string,
  role: WorkSegment['role'],
  start: string,
  end?: string,
): WorkSegment {
  return { personId, role, startedAt: t(start), endedAt: end ? t(end) : undefined };
}

function event(type: TicketEvent['type'], at: string, isVendor = false): TicketEvent {
  return { type, at: t(at), isVendor };
}

const base: FigureInput = {
  reportedAt: t('2026-01-01T10:00:00Z'),
  kind: 'stopped',
  selfStarted: false,
  events: [],
  segments: [],
  now: t('2026-01-01T12:00:00Z'),
};

describe('figures', () => {
  it('computes response as first start minus reported, null when self-started or unstarted', () => {
    expect(figures({ ...base, events: [event('start', '2026-01-01T10:20:00Z')] }).responseMin).toBe(
      20,
    );
    expect(
      figures({ ...base, events: [event('start', '2026-01-01T10:20:00Z')], selfStarted: true })
        .responseMin,
    ).toBeNull();
    expect(figures(base).responseMin).toBeNull();
  });

  it('unions overlapping hands-on segments', () => {
    const result = figures({
      ...base,
      segments: [
        seg('a', 'lead', '2026-01-01T10:00:00Z', '2026-01-01T11:00:00Z'),
        seg('b', 'support', '2026-01-01T10:30:00Z', '2026-01-01T11:30:00Z'),
      ],
    });
    expect(result.activeMin).toBe(90);
    expect(result.perPerson).toEqual({ a: 60, b: 60 });
  });

  it('computes waiting and vendor subset', () => {
    const result = figures({
      ...base,
      events: [
        event('pause', '2026-01-01T11:00:00Z', true),
        event('resume', '2026-01-01T11:30:00Z'),
        event('pause', '2026-01-01T11:40:00Z'),
        event('resume', '2026-01-01T11:50:00Z'),
      ],
    });
    expect(result.waitMin).toBe(40);
    expect(result.vendorMin).toBe(30);
  });

  it('computes handover wait from transfer to pickup', () => {
    const result = figures({
      ...base,
      events: [event('transfer', '2026-01-01T12:00:00Z'), event('pickup', '2026-01-01T12:15:00Z')],
    });
    expect(result.handoverWaitMin).toBe(15);
  });

  it('computes downtime across running and stopped stretches', () => {
    const result = figures({
      ...base,
      reportedAt: t('2026-01-01T09:00:00Z'),
      events: [event('running', '2026-01-01T09:30:00Z'), event('stopped', '2026-01-01T10:00:00Z')],
      now: t('2026-01-01T10:30:00Z'),
    });
    // 09:00->09:30 (30) + 10:00->10:30 (30)
    expect(result.downAccMin).toBe(60);
  });

  it('enforces a minimum of one minute of downtime at close', () => {
    const result = figures({
      ...base,
      now: t('2026-01-01T10:00:30Z'),
      closedAt: t('2026-01-01T10:00:30Z'),
    });
    expect(result.downtimeMin).toBe(1);
  });

  it('computes follow-up from the last running event to close', () => {
    const result = figures({
      ...base,
      events: [event('running', '2026-01-01T11:00:00Z')],
      closedAt: t('2026-01-01T11:20:00Z'),
    });
    expect(result.followMin).toBe(20);
  });

  it('applies overrides last and flags them', () => {
    const result = figures({ ...base, overrides: { responseMin: 7, waitingOverrideMin: 9 } });
    expect(result.responseMin).toBe(7);
    expect(result.waitMin).toBe(9);
    expect(result.overridden).toEqual(expect.arrayContaining(['responseMin', 'waitMin']));
  });

  it('applies the hands-on override and flags it', () => {
    const result = figures({ ...base, overrides: { handsOnOverrideMin: 99 } });
    expect(result.activeMin).toBe(99);
    expect(result.overridden).toContain('activeMin');
    expect(result.overridden).not.toContain('waitMin');
  });

  it('stops the downtime clock at cancel', () => {
    const result = figures({
      ...base,
      reportedAt: t('2026-01-01T09:00:00Z'),
      events: [event('cancel', '2026-01-01T09:30:00Z')],
      now: t('2026-01-01T14:00:00Z'),
    });
    // 09:00 -> 09:30, then the cancelled gap counts in nothing.
    expect(result.downAccMin).toBe(30);
  });

  it('resumes the downtime clock at restore when it was down at cancel', () => {
    const result = figures({
      ...base,
      reportedAt: t('2026-01-01T09:00:00Z'),
      events: [event('cancel', '2026-01-01T09:30:00Z'), event('restore', '2026-01-01T10:00:00Z')],
      now: t('2026-01-01T11:00:00Z'),
    });
    // 09:00 -> 09:30 (30) + 10:00 -> 11:00 (60); the cancelled gap counts in nothing.
    expect(result.downAccMin).toBe(90);
  });

  it('stops the handover wait at cancel', () => {
    const result = figures({
      ...base,
      events: [event('transfer', '2026-01-01T11:00:00Z'), event('cancel', '2026-01-01T11:30:00Z')],
      now: t('2026-01-01T14:00:00Z'),
    });
    expect(result.handoverWaitMin).toBe(30);
  });

  it('reopens the wait clock at restore so waits sum across a cancel', () => {
    const result = figures({
      ...base,
      events: [
        event('pause', '2026-01-01T10:00:00Z'),
        event('cancel', '2026-01-01T10:10:00Z'),
        event('restore', '2026-01-01T10:10:00Z'),
      ],
      now: t('2026-01-01T10:40:00Z'),
    });
    // 10:00 -> 10:10 (10) + 10:10 -> 10:40 (30).
    expect(result.waitMin).toBe(40);
  });
});
