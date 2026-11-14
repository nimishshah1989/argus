import { describe, expect, it } from 'vitest';
import { projectPauseTimer, type SlaPolicy, type SlaProjectionInput } from '../src/index.js';
import type { TicketEvent } from '../src/types.js';

const t = (iso: string) => new Date(iso);
const policy: SlaPolicy = {
  id: 'policy-s2',
  severity: 'S2',
  ackMinutes: 15,
  restoreMinutes: 240,
  pauseMaxMinutes: 60,
  businessHoursOnly: false,
};
const down: TicketEvent = { type: 'down', at: t('2026-01-01T10:00:00Z') };
const pause = (at: string, pausesSla = true): TicketEvent => ({
  type: 'pause',
  at: t(at),
  pausesSla,
});
const at = (type: TicketEvent['type'], iso: string): TicketEvent => ({ type, at: t(iso) });

function input(
  events: TicketEvent[],
  now: string,
  over: Partial<SlaPolicy> = {},
): SlaProjectionInput {
  return {
    ticket: {
      id: 'ticket-1',
      kind: 'stopped',
      severity: 'S2',
      status: 'waiting',
      reportedAt: t('2026-01-01T10:00:00Z'),
      closedAt: null,
    },
    events: [down, ...events],
    policy: { ...policy, ...over },
    now: t(now),
  };
}

describe('pause clock projection', () => {
  it('has no clock until the ticket is paused, or when the policy sets no maximum', () => {
    expect(projectPauseTimer(input([], '2026-01-01T10:30:00Z'))).toBeNull();
    const events = [pause('2026-01-01T10:10:00Z')];
    expect(
      projectPauseTimer(input(events, '2026-01-01T10:30:00Z', { pauseMaxMinutes: null })),
    ).toBeNull();
    const bare: SlaPolicy = { ...policy };
    delete bare.pauseMaxMinutes;
    const unset = { ...input(events, '2026-01-01T10:30:00Z'), policy: bare };
    expect(projectPauseTimer(unset)).toBeNull();
  });

  it('runs from the start of the pause and is due after the maximum', () => {
    const clock = projectPauseTimer(input([pause('2026-01-01T10:10:00Z')], '2026-01-01T10:40:00Z'));
    expect(clock).toEqual({
      id: 'ticket-1:pause',
      state: 'running',
      breached: false,
      dueAt: t('2026-01-01T11:10:00Z'),
      pausedAt: null,
      stoppedAt: null,
      remainingMinutes: 30,
      stopReason: null,
    });
  });

  it('is breached once the maximum is reached, and stays running until work resumes', () => {
    const events = [pause('2026-01-01T10:10:00Z')];
    expect(projectPauseTimer(input(events, '2026-01-01T11:09:59Z'))?.breached).toBe(false);
    const late = projectPauseTimer(input(events, '2026-01-01T11:10:00Z'));
    expect(late).toMatchObject({ state: 'running', breached: true, remainingMinutes: 0 });
  });

  it('does not count a pause whose reason does not pause the restore clock', () => {
    const events = [pause('2026-01-01T10:10:00Z', false)];
    expect(projectPauseTimer(input(events, '2026-01-01T10:20:00Z'))).toBeNull();
    const later = [...events, pause('2026-01-01T10:30:00Z')];
    expect(projectPauseTimer(input(later, '2026-01-01T10:40:00Z'))?.dueAt).toEqual(
      t('2026-01-01T11:30:00Z'),
    );
  });

  it('stops on resume: in time is not a breach, over the maximum is', () => {
    const inTime = projectPauseTimer(
      input(
        [pause('2026-01-01T10:10:00Z'), at('resume', '2026-01-01T10:50:00Z')],
        '2026-01-01T12:00:00Z',
      ),
    );
    expect(inTime).toMatchObject({
      state: 'stopped',
      breached: false,
      stoppedAt: t('2026-01-01T10:50:00Z'),
      stopReason: 'resumed',
    });
    const over = projectPauseTimer(
      input(
        [pause('2026-01-01T10:10:00Z'), at('resume', '2026-01-01T11:30:00Z')],
        '2026-01-01T12:00:00Z',
      ),
    );
    expect(over).toMatchObject({ state: 'stopped', breached: true, stopReason: 'resumed' });
  });

  it('a second pause starts a new clock from its own start', () => {
    const events = [
      pause('2026-01-01T10:10:00Z'),
      at('resume', '2026-01-01T10:20:00Z'),
      pause('2026-01-01T11:00:00Z'),
    ];
    const clock = projectPauseTimer(input(events, '2026-01-01T11:30:00Z'));
    expect(clock).toMatchObject({
      state: 'running',
      dueAt: t('2026-01-01T12:00:00Z'),
      stopReason: null,
    });
  });

  it('stops when the ticket closes or is cancelled while paused', () => {
    const paused = pause('2026-01-01T10:10:00Z');
    const closed = projectPauseTimer(
      input([paused, at('close', '2026-01-01T10:30:00Z')], '2026-01-01T12:00:00Z'),
    );
    expect(closed).toMatchObject({ state: 'stopped', stopReason: 'closed', breached: false });
    const cancelled = projectPauseTimer(
      input([paused, at('cancel', '2026-01-01T10:30:00Z')], '2026-01-01T12:00:00Z'),
    );
    expect(cancelled).toMatchObject({ state: 'stopped', stopReason: 'cancelled' });
  });

  it('restoring a ticket cancelled while waiting restarts the clock at the restore', () => {
    const cancel: TicketEvent = {
      type: 'cancel',
      at: t('2026-01-01T10:30:00Z'),
      status: 'waiting',
    };
    const events = [pause('2026-01-01T10:10:00Z'), cancel, at('restore', '2026-01-01T11:00:00Z')];
    const clock = projectPauseTimer(input(events, '2026-01-01T11:20:00Z'));
    expect(clock).toMatchObject({ state: 'running', dueAt: t('2026-01-01T12:00:00Z') });
  });

  it('restoring a ticket cancelled in another status, or with no status recorded, starts no clock', () => {
    const paused = pause('2026-01-01T10:10:00Z');
    for (const status of [undefined, 'open' as const, 'working' as const]) {
      const cancel: TicketEvent = { type: 'cancel', at: t('2026-01-01T10:30:00Z'), status };
      const events = [paused, cancel, at('restore', '2026-01-01T11:00:00Z')];
      expect(projectPauseTimer(input(events, '2026-01-01T11:20:00Z'))).toMatchObject({
        state: 'stopped',
        stopReason: 'cancelled',
      });
    }
  });
});
