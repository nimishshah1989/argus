import { describe, expect, it, vi } from 'vitest';
import {
  projectSlaTimers,
  raiseTicket,
  recordPastBreakdown,
  remainingSlaMinutes,
  slaBreached,
  type SlaPolicy,
  type SlaProjectionInput,
} from '../src/index.js';

const t = (iso: string) => new Date(iso);

const policy: SlaPolicy = {
  id: 'policy-s3',
  severity: 'S3',
  ackMinutes: 15,
  restoreMinutes: 60,
  businessHoursOnly: false,
};

function input(over: Partial<SlaProjectionInput> = {}): SlaProjectionInput {
  return {
    ticket: {
      id: 'ticket-1',
      kind: 'stopped',
      severity: 'S3',
      status: 'open',
      reportedAt: t('2026-01-01T10:00:00Z'),
      closedAt: null,
    },
    events: [{ type: 'down', at: t('2026-01-01T10:00:00Z') }],
    policy,
    now: t('2026-01-01T10:05:00Z'),
    ...over,
  };
}

describe('SLA timer presentation primitives', () => {
  it('rounds signed remaining milliseconds away from zero and breaches at exact due', () => {
    const due = t('2026-01-01T10:15:00Z');
    expect(remainingSlaMinutes(due, t('2026-01-01T10:00:00Z'))).toBe(15);
    expect(remainingSlaMinutes(due, t('2026-01-01T10:14:59.999Z'))).toBe(1);
    expect(remainingSlaMinutes(due, t('2026-01-01T10:15:00.001Z'))).toBe(-1);
    expect(slaBreached(due, t('2026-01-01T10:14:59.999Z'))).toBe(false);
    expect(slaBreached(due, due)).toBe(true);
  });
});

describe('SLA timer projection', () => {
  it('starts acknowledge and restore clocks at report with deterministic ids', () => {
    const result = projectSlaTimers(input());
    expect(result.ack).toEqual({
      id: 'ticket-1:ack',
      state: 'running',
      breached: false,
      dueAt: t('2026-01-01T10:15:00Z'),
      pausedAt: null,
      stoppedAt: null,
      remainingMinutes: 10,
      stopReason: null,
    });
    expect(result.restore).toMatchObject({
      id: 'ticket-1:restore',
      state: 'running',
      dueAt: t('2026-01-01T11:00:00Z'),
      remainingMinutes: 55,
    });
  });

  it('stops acknowledge at the earliest acknowledge or first response event', () => {
    const result = projectSlaTimers(
      input({
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'acknowledge', at: t('2026-01-01T10:04:00Z') },
          { type: 'start', at: t('2026-01-01T10:06:00Z') },
        ],
        now: t('2026-01-01T10:06:00Z'),
      }),
    );
    expect(result.ack).toMatchObject({
      state: 'stopped',
      breached: false,
      stoppedAt: t('2026-01-01T10:04:00Z'),
      stopReason: 'acknowledged',
      remainingMinutes: 11,
    });
  });

  it('stops restore at first machine-running and never restarts it on machine-stopped', () => {
    const result = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'working' },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'start', at: t('2026-01-01T10:05:00Z') },
          { type: 'running', at: t('2026-01-01T10:30:00Z') },
          { type: 'stopped', at: t('2026-01-01T10:40:00Z') },
        ],
        now: t('2026-01-01T12:00:00Z'),
      }),
    );
    expect(result.restore).toMatchObject({
      state: 'stopped',
      breached: false,
      stoppedAt: t('2026-01-01T10:30:00Z'),
      stopReason: 'machine_running',
      remainingMinutes: 30,
    });
  });

  it('stops both clocks at close even when there was no start', () => {
    const closedAt = t('2026-01-01T10:20:00Z');
    const result = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'closed', closedAt },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'close', at: closedAt },
        ],
        now: t('2026-01-01T12:00:00Z'),
      }),
    );
    expect(result.ack).toMatchObject({
      state: 'stopped',
      breached: true,
      stoppedAt: closedAt,
      stopReason: 'closed',
    });
    expect(result.restore).toMatchObject({
      state: 'stopped',
      breached: false,
      stoppedAt: closedAt,
      stopReason: 'closed',
      remainingMinutes: 40,
    });
  });

  it('freezes restore remaining time during a historical SLA-pausing wait', () => {
    const result = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'waiting' },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'start', at: t('2026-01-01T10:05:00Z') },
          {
            type: 'pause',
            at: t('2026-01-01T10:20:00Z'),
            reason: 'spare',
            pausesSla: true,
          },
        ],
        now: t('2026-01-01T10:30:00Z'),
      }),
    );
    expect(result.restore).toEqual({
      id: 'ticket-1:restore',
      state: 'paused',
      breached: false,
      dueAt: null,
      pausedAt: t('2026-01-01T10:20:00Z'),
      stoppedAt: null,
      remainingMinutes: 40,
      stopReason: null,
    });
  });

  it('restarts restore on resume with only the paused wall time excluded', () => {
    const result = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'working' },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'start', at: t('2026-01-01T10:05:00Z') },
          {
            type: 'pause',
            at: t('2026-01-01T10:20:00Z'),
            reason: 'spare',
            pausesSla: true,
          },
          { type: 'resume', at: t('2026-01-01T10:40:00Z') },
        ],
        now: t('2026-01-01T10:40:00Z'),
      }),
    );
    expect(result.restore).toMatchObject({
      state: 'running',
      dueAt: t('2026-01-01T11:20:00Z'),
      pausedAt: null,
      remainingMinutes: 40,
      breached: false,
    });
  });

  it('excludes the cancelled gap when unfinished clocks are restored', () => {
    const result = projectSlaTimers(
      input({
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'cancel', at: t('2026-01-01T10:10:00Z'), status: 'open' },
          { type: 'restore', at: t('2026-01-01T10:40:00Z') },
        ],
        now: t('2026-01-01T10:40:00Z'),
      }),
    );
    expect(result.ack).toMatchObject({
      state: 'running',
      dueAt: t('2026-01-01T10:45:00Z'),
      remainingMinutes: 5,
    });
    expect(result.restore).toMatchObject({
      state: 'running',
      dueAt: t('2026-01-01T11:30:00Z'),
      remainingMinutes: 50,
    });
  });

  it('marks a currently cancelled ticket cancelled even after ack already stopped', () => {
    const result = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'cancelled' },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'start', at: t('2026-01-01T10:05:00Z') },
          { type: 'cancel', at: t('2026-01-01T10:10:00Z'), status: 'working' },
        ],
        now: t('2026-01-01T10:20:00Z'),
      }),
    );
    expect(result.ack).toMatchObject({
      state: 'stopped',
      stoppedAt: t('2026-01-01T10:10:00Z'),
      stopReason: 'cancelled',
      dueAt: t('2026-01-01T10:15:00Z'),
      remainingMinutes: 10,
      breached: false,
    });
  });

  it('restores a cancelled SLA pause at the restore boundary and resumes its remainder', () => {
    const events = [
      { type: 'down', at: t('2026-01-01T10:00:00Z') },
      { type: 'start', at: t('2026-01-01T10:02:00Z') },
      {
        type: 'pause',
        at: t('2026-01-01T10:05:00Z'),
        reason: 'spare',
        pausesSla: true,
      },
      { type: 'cancel', at: t('2026-01-01T10:10:00Z'), status: 'waiting' },
      { type: 'restore', at: t('2026-01-01T10:40:00Z') },
    ] as SlaProjectionInput['events'];
    const paused = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'waiting' },
        events,
        now: t('2026-01-01T10:40:00Z'),
      }),
    );
    expect(paused.restore).toMatchObject({
      state: 'paused',
      pausedAt: t('2026-01-01T10:40:00Z'),
      dueAt: null,
      remainingMinutes: 55,
    });
    const resumed = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'working' },
        events: [...events, { type: 'resume', at: t('2026-01-01T10:50:00Z') }],
        now: t('2026-01-01T10:50:00Z'),
      }),
    );
    expect(resumed.restore).toMatchObject({
      state: 'running',
      dueAt: t('2026-01-01T11:45:00Z'),
      remainingMinutes: 55,
    });
  });

  it('applies startedAt corrections to first response rather than a later pickup', () => {
    const result = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'working' },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'start', at: t('2026-01-01T10:10:00Z') },
          { type: 'pickup', at: t('2026-01-01T10:30:00Z') },
          {
            type: 'edit',
            at: t('2026-01-01T11:00:00Z'),
            changes: [
              {
                field: 'startedAt',
                from: t('2026-01-01T10:10:00Z'),
                to: t('2026-01-01T10:05:00Z'),
              },
            ],
          },
        ],
        now: t('2026-01-01T11:00:00Z'),
      }),
    );
    expect(result.ack).toMatchObject({
      stoppedAt: t('2026-01-01T10:05:00Z'),
      stopReason: 'started',
      remainingMinutes: 10,
      breached: false,
    });
  });

  it('uses the corrected closedAt as the effective close', () => {
    const result = projectSlaTimers(
      input({
        ticket: {
          ...input().ticket,
          status: 'closed',
          closedAt: t('2026-01-01T10:40:00Z'),
        },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'close', at: t('2026-01-01T10:50:00Z') },
          {
            type: 'edit',
            at: t('2026-01-01T11:00:00Z'),
            changes: [
              {
                field: 'closedAt',
                from: t('2026-01-01T10:50:00Z'),
                to: t('2026-01-01T10:40:00Z'),
              },
            ],
          },
        ],
        now: t('2026-01-01T11:00:00Z'),
      }),
    );
    expect(result.restore).toMatchObject({
      stoppedAt: t('2026-01-01T10:40:00Z'),
      stopReason: 'closed',
      remainingMinutes: 20,
      breached: false,
    });
  });

  it('rejects corrected terminals beyond now, before report, or after close', () => {
    const correction = (field: 'startedAt' | 'closedAt', to: Date) => ({
      type: 'edit' as const,
      at: t('2026-01-01T11:00:00Z'),
      changes: [{ field, from: t('2026-01-01T10:10:00Z'), to }],
    });
    expect(() =>
      projectSlaTimers(
        input({
          ticket: { ...input().ticket, status: 'working' },
          events: [
            { type: 'down', at: t('2026-01-01T10:00:00Z') },
            { type: 'start', at: t('2026-01-01T10:10:00Z') },
            correction('startedAt', t('2026-01-01T12:00:00Z')),
          ],
          now: t('2026-01-01T11:00:00Z'),
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'invalid_timeline' }));
    expect(() =>
      projectSlaTimers(
        input({
          ticket: {
            ...input().ticket,
            status: 'closed',
            closedAt: t('2026-01-01T10:50:00Z'),
          },
          events: [
            { type: 'down', at: t('2026-01-01T10:00:00Z') },
            { type: 'close', at: t('2026-01-01T10:50:00Z') },
            correction('closedAt', t('2026-01-01T12:00:00Z')),
          ],
          now: t('2026-01-01T11:00:00Z'),
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'invalid_timeline' }));
    expect(() =>
      projectSlaTimers(
        input({
          ticket: { ...input().ticket, status: 'working' },
          events: [
            { type: 'down', at: t('2026-01-01T10:00:00Z') },
            { type: 'start', at: t('2026-01-01T10:10:00Z') },
            correction('startedAt', t('2026-01-01T09:00:00Z')),
          ],
          now: t('2026-01-01T11:00:00Z'),
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'invalid_timeline' }));
    expect(() =>
      projectSlaTimers(
        input({
          ticket: {
            ...input().ticket,
            status: 'closed',
            closedAt: t('2026-01-01T10:50:00Z'),
          },
          events: [
            { type: 'down', at: t('2026-01-01T10:00:00Z') },
            { type: 'start', at: t('2026-01-01T10:10:00Z') },
            { type: 'close', at: t('2026-01-01T10:50:00Z') },
            correction('startedAt', t('2026-01-01T10:55:00Z')),
          ],
          now: t('2026-01-01T11:00:00Z'),
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'invalid_timeline' }));
  });

  it('rejects a pause without its historical pausesSla snapshot', () => {
    expect(() =>
      projectSlaTimers(
        input({
          ticket: { ...input().ticket, status: 'waiting' },
          events: [
            { type: 'down', at: t('2026-01-01T10:00:00Z') },
            { type: 'pause', at: t('2026-01-01T10:10:00Z'), reason: 'legacy' },
          ],
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'missing_pause_flag' }));
  });

  it('computes restore due across declared daily business windows', () => {
    const result = projectSlaTimers(
      input({
        ticket: { ...input().ticket, reportedAt: t('2026-01-02T16:00:00Z') },
        events: [{ type: 'down', at: t('2026-01-02T16:00:00Z') }],
        policy: { ...policy, restoreMinutes: 120, businessHoursOnly: true },
        calendar: {
          timeZone: 'UTC',
          windows: [
            { code: 'day', startMinute: 9 * 60, endMinute: 17 * 60, crossesMidnight: false },
          ],
        },
        now: t('2026-01-02T16:00:00Z'),
      }),
    );
    expect(result.restore).toMatchObject({
      state: 'running',
      dueAt: t('2026-01-03T10:00:00Z'),
      remainingMinutes: 120,
      pausedAt: null,
      breached: false,
    });
  });

  it('rejects invalid policies and effective timelines instead of clamping them', () => {
    expect(() => projectSlaTimers(input({ policy: { ...policy, ackMinutes: 0 } }))).toThrow(
      expect.objectContaining({ code: 'invalid_policy' }),
    );
    expect(() => projectSlaTimers(input({ policy: { ...policy, severity: 'S1' } }))).toThrow(
      expect.objectContaining({ code: 'invalid_policy' }),
    );
    expect(() =>
      projectSlaTimers(
        input({
          ticket: { ...input().ticket, reportedAt: t('2026-01-01T11:00:00Z') },
          now: t('2026-01-01T10:00:00Z'),
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'invalid_timeline' }));
    expect(() =>
      projectSlaTimers(
        input({
          events: [
            { type: 'down', at: t('2026-01-01T10:00:00Z') },
            { type: 'start', at: t('2026-01-01T09:00:00Z') },
          ],
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'invalid_timeline' }));
  });

  it('treats a terminal event exactly at the deadline as on time', () => {
    const result = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'working' },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'start', at: t('2026-01-01T10:15:00Z') },
        ],
        now: t('2026-01-01T10:15:00Z'),
      }),
    );
    expect(result.ack).toMatchObject({ state: 'stopped', breached: false, remainingMinutes: 0 });
  });

  it('retains the due instant and breached state when paused after the deadline', () => {
    const result = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'waiting' },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          {
            type: 'pause',
            at: t('2026-01-01T11:10:00Z'),
            reason: 'spare',
            pausesSla: true,
          },
        ],
        now: t('2026-01-01T11:20:00Z'),
      }),
    );
    expect(result.restore).toMatchObject({
      state: 'paused',
      breached: true,
      dueAt: t('2026-01-01T11:00:00Z'),
      pausedAt: t('2026-01-01T11:10:00Z'),
      remainingMinutes: -10,
    });
  });

  it('does not pause restore for non-SLA waits, vendor flags, or handover waits', () => {
    const result = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'working' },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'start', at: t('2026-01-01T10:05:00Z') },
          {
            type: 'pause',
            at: t('2026-01-01T10:20:00Z'),
            reason: 'production',
            isVendor: true,
            pausesSla: false,
          },
          { type: 'resume', at: t('2026-01-01T10:40:00Z') },
          { type: 'transfer', at: t('2026-01-01T10:45:00Z') },
          { type: 'pickup', at: t('2026-01-01T10:50:00Z') },
        ],
        now: t('2026-01-01T10:50:00Z'),
      }),
    );
    expect(result.restore).toMatchObject({
      state: 'running',
      dueAt: t('2026-01-01T11:00:00Z'),
      pausedAt: null,
      remainingMinutes: 10,
    });
  });

  it('pauses and resumes business-mode clocks across an off-hours gap', () => {
    const calendar = {
      timeZone: 'UTC',
      windows: [{ code: 'day', startMinute: 9 * 60, endMinute: 17 * 60, crossesMidnight: false }],
    };
    const businessPolicy = { ...policy, restoreMinutes: 120, businessHoursOnly: true };
    const events = [
      { type: 'down', at: t('2026-01-02T16:00:00Z') },
      {
        type: 'pause',
        at: t('2026-01-02T16:30:00Z'),
        reason: 'spare',
        pausesSla: true,
      },
    ] as SlaProjectionInput['events'];
    const paused = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'waiting', reportedAt: t('2026-01-02T16:00:00Z') },
        events,
        policy: businessPolicy,
        calendar,
        now: t('2026-01-02T18:00:00Z'),
      }),
    );
    expect(paused.restore).toMatchObject({ state: 'paused', dueAt: null, remainingMinutes: 90 });
    const resumed = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'working', reportedAt: t('2026-01-02T16:00:00Z') },
        events: [...events, { type: 'resume', at: t('2026-01-03T09:00:00Z') }],
        policy: businessPolicy,
        calendar,
        now: t('2026-01-03T09:00:00Z'),
      }),
    );
    expect(resumed.restore).toMatchObject({
      state: 'running',
      dueAt: t('2026-01-03T10:30:00Z'),
      remainingMinutes: 90,
    });
  });

  it('recomputes from corrected report origin and the newly resolved policy', () => {
    const result = projectSlaTimers(
      input({
        ticket: { ...input().ticket, reportedAt: t('2026-01-01T09:30:00Z') },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          {
            type: 'edit',
            at: t('2026-01-01T11:00:00Z'),
            changes: [
              {
                field: 'reportedAt',
                from: t('2026-01-01T10:00:00Z'),
                to: t('2026-01-01T09:30:00Z'),
              },
            ],
          },
        ],
        policy: { ...policy, restoreMinutes: 120 },
        now: t('2026-01-01T11:00:00Z'),
      }),
    );
    expect(result.ack).toMatchObject({ dueAt: t('2026-01-01T09:45:00Z'), breached: true });
    expect(result.restore).toMatchObject({
      dueAt: t('2026-01-01T11:30:00Z'),
      remainingMinutes: 30,
      breached: false,
    });
  });

  it('rejects a correction that places first response before the effective report', () => {
    expect(() =>
      projectSlaTimers(
        input({
          ticket: { ...input().ticket, status: 'working' },
          events: [
            { type: 'down', at: t('2026-01-01T10:00:00Z') },
            { type: 'start', at: t('2026-01-01T10:10:00Z') },
            {
              type: 'edit',
              at: t('2026-01-01T11:00:00Z'),
              changes: [
                {
                  field: 'startedAt',
                  from: t('2026-01-01T10:10:00Z'),
                  to: t('2026-01-01T09:00:00Z'),
                },
              ],
            },
          ],
          now: t('2026-01-01T11:00:00Z'),
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'invalid_timeline' }));
  });

  it('does not mutate the ticket, events, or policy during projection', () => {
    const effective = input();
    const before = JSON.stringify(effective);
    projectSlaTimers(effective);
    expect(JSON.stringify(effective)).toBe(before);
  });

  it('breaches at exact due under a fake system clock', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(t('2026-01-01T10:15:00Z'));
      const result = projectSlaTimers(input({ now: new Date() }));
      expect(result.ack).toMatchObject({ breached: true, remainingMinutes: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('resumes a paused restore before a later close terminal', () => {
    const result = projectSlaTimers(
      input({
        ticket: {
          ...input().ticket,
          status: 'closed',
          closedAt: t('2026-01-01T10:50:00Z'),
        },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'start', at: t('2026-01-01T10:05:00Z') },
          {
            type: 'pause',
            at: t('2026-01-01T10:20:00Z'),
            reason: 'spare',
            pausesSla: true,
          },
          { type: 'resume', at: t('2026-01-01T10:40:00Z') },
          { type: 'close', at: t('2026-01-01T10:50:00Z') },
        ],
        now: t('2026-01-01T11:00:00Z'),
      }),
    );
    expect(result.restore).toMatchObject({
      state: 'stopped',
      stopReason: 'closed',
      stoppedAt: t('2026-01-01T10:50:00Z'),
      dueAt: t('2026-01-01T11:20:00Z'),
      remainingMinutes: 30,
      breached: false,
    });
  });

  it('stops restore on machine-running even during an SLA-pausing wait', () => {
    const result = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'waiting' },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'start', at: t('2026-01-01T10:05:00Z') },
          {
            type: 'pause',
            at: t('2026-01-01T10:20:00Z'),
            reason: 'spare',
            pausesSla: true,
          },
          { type: 'running', at: t('2026-01-01T10:30:00Z') },
        ],
        now: t('2026-01-01T11:00:00Z'),
      }),
    );
    expect(result.restore).toMatchObject({
      state: 'stopped',
      stopReason: 'machine_running',
      stoppedAt: t('2026-01-01T10:30:00Z'),
      pausedAt: null,
      remainingMinutes: 40,
    });
  });

  it('rejects malformed correction timestamps instead of ignoring them', () => {
    expect(() =>
      projectSlaTimers(
        input({
          ticket: { ...input().ticket, status: 'working' },
          events: [
            { type: 'down', at: t('2026-01-01T10:00:00Z') },
            { type: 'start', at: t('2026-01-01T10:10:00Z') },
            {
              type: 'edit',
              at: t('2026-01-01T11:00:00Z'),
              changes: [
                {
                  field: 'startedAt',
                  from: '2026-01-01T10:10:00Z',
                  to: '2026-01-01T10:05:00Z',
                },
              ],
            },
          ],
          now: t('2026-01-01T11:00:00Z'),
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'invalid_timeline' }));
  });

  it.each([
    { eventType: 'running' as const, stopReason: 'machine_running' as const },
    { eventType: 'close' as const, stopReason: 'closed' as const },
  ])('preserves a late restore breach at $eventType', ({ eventType, stopReason }) => {
    const stoppedAt = t('2026-01-01T11:10:00Z');
    const result = projectSlaTimers(
      input({
        ticket: {
          ...input().ticket,
          status: eventType === 'close' ? 'closed' : 'working',
          closedAt: eventType === 'close' ? stoppedAt : null,
        },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'start', at: t('2026-01-01T10:05:00Z') },
          { type: eventType, at: stoppedAt },
        ],
        now: t('2026-01-01T11:20:00Z'),
      }),
    );
    expect(result.restore).toMatchObject({
      state: 'stopped',
      breached: true,
      stoppedAt,
      stopReason,
      dueAt: t('2026-01-01T11:00:00Z'),
      remainingMinutes: -10,
    });
  });

  it('keeps a late first start stopped and breached without hiding the miss', () => {
    const result = projectSlaTimers(
      input({
        ticket: { ...input().ticket, status: 'working' },
        events: [
          { type: 'down', at: t('2026-01-01T10:00:00Z') },
          { type: 'start', at: t('2026-01-01T10:20:00Z') },
        ],
        now: t('2026-01-01T10:30:00Z'),
      }),
    );
    expect(result.ack).toMatchObject({
      state: 'stopped',
      breached: true,
      dueAt: t('2026-01-01T10:15:00Z'),
      stoppedAt: t('2026-01-01T10:20:00Z'),
      remainingMinutes: -5,
      stopReason: 'started',
    });
  });
});

describe('the SLA policy of a domain ticket', () => {
  it('is not carried on the ticket, live or past: the policy is found by the ticket’s severity', () => {
    const common = {
      kind: 'stopped' as const,
      machineId: 'machine-1',
      problem: 'Test',
      raisedLoginId: 'login-1',
      reportedByPersonId: 'person-1',
    };
    const raised = raiseTicket({
      ...common,
      id: 'ticket-live',
      ref: 'BD-0001',
      reportedAt: t('2026-01-01T10:00:00Z'),
      selfStarted: false,
      startNow: false,
    });
    const past = recordPastBreakdown({
      ...common,
      id: 'ticket-past',
      ref: 'BD-0002',
      reportedAt: t('2026-01-01T09:00:00Z'),
      closedAt: t('2026-01-01T10:00:00Z'),
      closedByPersonId: 'person-1',
    });
    for (const { ticket } of [raised, past]) {
      expect(ticket.severity).toBeTruthy();
      expect('slaPolicyId' in ticket).toBe(false);
    }
  });
});
