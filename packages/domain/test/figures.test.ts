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

  it('counts the lead only as hands-on; a crew member keeps their own minutes', () => {
    const result = figures({
      ...base,
      segments: [
        seg('a', 'lead', '2026-01-01T10:00:00Z', '2026-01-01T11:00:00Z'),
        seg('b', 'support', '2026-01-01T10:30:00Z', '2026-01-01T11:30:00Z'),
      ],
    });
    expect(result.activeMin).toBe(60);
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
      closedAt: t('2026-01-01T10:30:00Z'),
    });
    // 09:00->09:30 (30) is finished; 10:00->10:30 (30) ends at the close
    expect(result.downAccMin).toBe(30);
    expect(result.downtimeMin).toBe(60);
  });

  it('rounds to the nearest minute, as his worker does', () => {
    const closedAt = t('2026-01-01T10:20:31Z');
    expect(figures({ ...base, closedAt, now: closedAt }).downtimeMin).toBe(21);
    const early = t('2026-01-01T10:20:29Z');
    expect(figures({ ...base, closedAt: early, now: early }).downtimeMin).toBe(20);
  });

  it('measures repair on the wall clock from the first start to the close or to running again', () => {
    const events = [event('start', '2026-01-01T10:10:00Z'), event('pause', '2026-01-01T10:20:00Z')];
    const closedAt = t('2026-01-01T11:00:00Z');
    expect(figures({ ...base, events, closedAt, now: closedAt }).repairMin).toBe(50);
    const ran = [...events, event('running', '2026-01-01T10:40:00Z')];
    expect(figures({ ...base, events: ran, closedAt, now: closedAt }).repairMin).toBe(30);
    expect(figures({ ...base, closedAt, now: closedAt }).repairMin).toBe(0);
  });

  it('gives support no downtime and a general job its hands-on minutes', () => {
    const closedAt = t('2026-01-01T11:00:00Z');
    const segments = [seg('a', 'lead', '2026-01-01T10:00:00Z', '2026-01-01T10:45:00Z')];
    const input = { ...base, segments, closedAt, now: closedAt };
    expect(figures({ ...input, kind: 'support' }).downtimeMin).toBe(0);
    expect(figures({ ...input, kind: 'general' }).downtimeMin).toBe(45);
  });

  it('counts only finished stretches until the ticket moves on', () => {
    const result = figures({
      ...base,
      events: [event('pause', '2026-01-01T11:00:00Z'), event('transfer', '2026-01-01T11:10:00Z')],
      segments: [seg('a', 'lead', '2026-01-01T10:00:00Z')],
    });
    expect(result.waitMin).toBe(0);
    expect(result.handoverWaitMin).toBe(0);
    expect(result.activeMin).toBe(0);
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

  it('does not count the cancelled time as downtime (Nimish, 14 Nov; his worker does)', () => {
    const closedAt = t('2026-01-01T14:00:00Z');
    const result = figures({
      ...base,
      reportedAt: t('2026-01-01T09:00:00Z'),
      events: [event('cancel', '2026-01-01T09:30:00Z'), event('restore', '2026-01-01T10:00:00Z')],
      now: closedAt,
      closedAt,
    });
    // 09:00 -> 14:00 less the cancelled half hour
    expect(result.downtimeMin).toBe(270);
  });

  it('does not count the cancelled time in a handover wait', () => {
    const result = figures({
      ...base,
      events: [
        event('transfer', '2026-01-01T11:00:00Z'),
        event('cancel', '2026-01-01T11:30:00Z'),
        event('restore', '2026-01-01T12:00:00Z'),
        event('pickup', '2026-01-01T12:15:00Z'),
      ],
    });
    expect(result.handoverWaitMin).toBe(45);
  });

  it('lets a wait run through a cancel and a restore at the same minute', () => {
    const result = figures({
      ...base,
      events: [
        event('pause', '2026-01-01T10:00:00Z'),
        event('cancel', '2026-01-01T10:10:00Z'),
        event('restore', '2026-01-01T10:10:00Z'),
        event('close', '2026-01-01T10:40:00Z'),
      ],
      now: t('2026-01-01T10:40:00Z'),
    });
    expect(result.waitMin).toBe(40);
  });

  it('does not count the cancelled time in a wait', () => {
    const result = figures({
      ...base,
      events: [
        event('pause', '2026-01-01T10:00:00Z'),
        event('cancel', '2026-01-01T10:10:00Z'),
        event('restore', '2026-01-01T10:20:00Z'),
        event('close', '2026-01-01T10:40:00Z'),
      ],
      now: t('2026-01-01T10:40:00Z'),
    });
    expect(result.waitMin).toBe(30);
  });
});
