import { describe, expect, it } from 'vitest';
import {
  chainAcknowledged,
  mayAcknowledgeLevel,
  pendingEscalationLevels,
  reopenEpisode,
  projectSlaTimers,
  repeatAfterMinutes,
  severityAtLeast,
  transition,
  type EscalationHistoryEvent,
  type SlaProjectionInput,
  type TicketEvent,
} from '../src/index.js';
import { raiseTicket } from '../src/state.js';

const t = (hhmm: string) => new Date(`2026-01-01T${hhmm}:00Z`);

describe('severity floor', () => {
  it('a rule from S3 covers S1, S2 and S3 but not S4', () => {
    expect(['S1', 'S2', 'S3', 'S4'].map((s) => severityAtLeast(s, 'S3'))).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(severityAtLeast('S9', 'S3')).toBe(false);
  });
});

describe('repeats', () => {
  it('repeat cap is the number of repeats after the first notice', () => {
    const rule = { repeatMinutes: 30, repeatCap: 3 };
    expect([1, 2, 3, 4].map((attempt) => repeatAfterMinutes(rule, attempt))).toEqual([
      30,
      30,
      30,
      null,
    ]);
    expect(repeatAfterMinutes({ repeatMinutes: null, repeatCap: null }, 1)).toBeNull();
  });
});

const step = (ruleId: string, level: string, episode = 1): EscalationHistoryEvent => ({
  type: 'escalate',
  payload: { escalation: { ruleId, level, episode } },
});
const ack = (level: string): EscalationHistoryEvent => ({
  type: 'escalation_ack',
  payload: { level },
});

describe('acknowledging an escalation', () => {
  it('covers the chains at or below its level that already told someone, and no later one', () => {
    const events = [step('a', 'L2'), step('b', 'L3'), ack('L2'), step('c', 'L2')];
    expect(chainAcknowledged(events, 'a', 1)).toBe(true);
    expect(chainAcknowledged(events, 'b', 1)).toBe(false);
    expect(chainAcknowledged(events, 'c', 1)).toBe(false);
    expect(pendingEscalationLevels(events)).toEqual(['L3', 'L2']);
  });

  it('a rule edited mid-chain: the latest step decides the level', () => {
    const events = [step('a', 'L2'), step('a', 'L3')];
    expect(pendingEscalationLevels(events)).toEqual(['L3']);
  });

  it('is by role: technician L1, supervisor L2, head L3, plant head L4, admin all, others none', () => {
    const roles = ['operator', 'board', 'technician', 'supervisor', 'head', 'plant_head', 'admin'];
    expect(roles.map((r) => mayAcknowledgeLevel(r, 'L3'))).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
    expect(mayAcknowledgeLevel('technician', 'L1')).toBe(true);
    expect(mayAcknowledgeLevel('technician', 'vendor')).toBe(true);
  });
});

describe('the acknowledge clock after a handover', () => {
  const policy = {
    id: 'p',
    severity: 'S3' as const,
    ackMinutes: 15,
    restoreMinutes: 60,
    businessHoursOnly: false,
  };
  const base = (events: TicketEvent[], now: string): SlaProjectionInput => ({
    ticket: {
      id: 't',
      kind: 'stopped',
      severity: 'S3',
      status: 'open',
      reportedAt: t('10:00'),
      closedAt: null,
    },
    events: [{ type: 'down', at: t('10:00') }, ...events],
    policy,
    now: t(now),
  });

  it('starts again at the transfer, in full, and stops on the next pickup', () => {
    const worked: TicketEvent[] = [
      { type: 'start', at: t('10:05') },
      { type: 'transfer', at: t('10:30') },
    ];
    const open = projectSlaTimers(base(worked, '10:40')).ack;
    expect(open).toMatchObject({ state: 'running', breached: false, dueAt: t('10:45') });
    expect(projectSlaTimers(base(worked, '10:50')).ack.breached).toBe(true);
    const picked = projectSlaTimers(base([...worked, { type: 'pickup', at: t('10:36') }], '10:50'));
    expect(picked.ack).toMatchObject({ state: 'stopped', stopReason: 'started', breached: false });
  });

  it('an acknowledge from before the handover does not count', () => {
    const events: TicketEvent[] = [
      { type: 'acknowledge', at: t('10:05') },
      { type: 'start', at: t('10:06') },
      { type: 'transfer', at: t('10:30') },
    ];
    expect(projectSlaTimers(base(events, '10:40')).ack.state).toBe('running');
  });
});

describe('the history floor', () => {
  it('an escalation notice does not stop a close placed before it', () => {
    const ticket = raiseTicket({
      id: 't',
      ref: 'BD-1',
      kind: 'stopped',
      machineId: 'm',
      problem: 'x',
      reportedAt: t('10:00'),
      raisedLoginId: 'l',
      reportedByPersonId: null,
      selfStarted: false,
      startNow: false,
    });
    const started = transition({
      ticket: ticket.ticket,
      events: ticket.events,
      segments: ticket.segments,
      crew: [],
      command: { type: 'start', personId: 'p', at: t('10:05') },
      ctx: { role: 'admin', loginId: 'l', personId: 'p', shared: false, now: t('11:00') },
    });
    const events: TicketEvent[] = [
      ...started.events,
      { type: 'escalate', at: t('11:30') },
      { type: 'escalation_ack', at: t('11:40') },
    ];
    const result = transition({
      ticket: started.ticket,
      events,
      segments: started.segments,
      crew: started.crew,
      command: { type: 'close', personId: 'p', kind: 'no_report', note: 'x', at: t('10:30') },
      ctx: { role: 'admin', loginId: 'l', personId: 'p', shared: false, now: t('12:00') },
    });
    expect(result.events.at(-1)).toMatchObject({ type: 'close', at: t('10:30') });
  });
});

describe('a ticket reopened twice', () => {
  const event = (type: string, hhmm: string) => ({ type, at: t(hhmm) });

  it('has no episode until production has sent the fix back a second time', () => {
    expect(reopenEpisode([])).toBeNull();
    expect(reopenEpisode([event('close', '09:00'), event('handback_dispute', '09:10')])).toBeNull();
  });

  it('names the second dispute as the episode, and each later dispute is a new one', () => {
    const log = [
      event('close', '09:00'),
      event('handback_dispute', '09:10'),
      event('close', '10:00'),
      event('handback_dispute', '10:10'),
    ];
    expect(reopenEpisode(log)).toBe(t('10:10').getTime());
    expect(
      reopenEpisode([...log, event('close', '11:00'), event('handback_dispute', '11:10')]),
    ).toBe(t('11:10').getTime());
  });
});
