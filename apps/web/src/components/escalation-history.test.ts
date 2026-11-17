import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { en } from '@uptimo/shared/i18n';
import type { TicketEvent } from '../api.js';
import { escalationLines } from './escalation-history.js';

type EscalationStep = NonNullable<TicketEvent['escalation']>;

/** The English catalogue as a plain `t`: the test reads the words a person sees, never the keys. */
const t = ((key: string, vars: Record<string, string | number> = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(vars[name]),
  )) as unknown as TFunction;

function event(
  seq: number,
  at: string,
  type: string,
  escalation?: Partial<EscalationStep> | null,
): TicketEvent {
  return {
    seq,
    type,
    at,
    text: null,
    reason: null,
    actingPersonId: null,
    loginId: null,
    isVendor: false,
    changes: null,
    escalation: escalation
      ? {
          ruleId: 'rule-1',
          trigger: 'ack_missed',
          episode: 1,
          level: 'L2',
          attempt: 1,
          channel: 'push',
          toldCount: 1,
          toldPersonIds: ['person-1'],
          ...escalation,
        }
      : null,
  };
}

const step = (seq: number, at: string, escalation: Partial<EscalationStep> = {}) =>
  event(seq, at, 'escalate', escalation);

const lines = (events: TicketEvent[], names: Record<string, string> = { 'person-1': 'Asha' }) => [
  ...escalationLines(events, names, t).values(),
];

const AT = '2026-11-11T10:00:00.000Z';

describe('escalationLines', () => {
  it('one line per step: level, trigger, who was told and the channel', () => {
    expect(lines([step(1, AT)])).toEqual(['L2 · no acknowledgement · Asha · Push']);
    expect(lines([step(2, AT, { level: 'L3', trigger: 'restore_missed' })])).toEqual([
      'L3 · no restoration · Asha · Push',
    ]);
  });

  it('says who was told by name, and lists every person told', () => {
    expect(
      lines([step(1, AT, { toldPersonIds: ['person-1', 'person-2'], toldCount: 2 })], {
        'person-1': 'Asha',
        'person-2': 'Bina',
      }),
    ).toEqual(['L2 · no acknowledgement · Asha, Bina · Push']);
  });

  it('reads exactly "Escalation due, nobody told" when the plant had no ladder', () => {
    expect(
      lines([step(1, AT, { noLadder: true, toldPersonIds: ['person-1'], toldCount: 1 })]),
    ).toEqual(['Escalation due, nobody told']);
  });

  it('names the fallback channel when WhatsApp has no sender yet', () => {
    expect(lines([step(1, AT, { channel: 'whatsapp', channelFallback: 'push' })])).toEqual([
      'L2 · no acknowledgement · Asha · Push (WhatsApp has no sender yet)',
    ]);
  });

  it('says nothing about a repeat on the first notice, and "repeat n" above a repeat', () => {
    expect(lines([step(1, AT)])[0]).not.toContain('repeat');
    expect(lines([step(2, '2026-11-11T10:30:00.000Z', { attempt: 2 })])[0]).toBe(
      'repeat 2 · L2 · no acknowledgement · Asha · Push',
    );
  });

  it('reads acknowledgement speed from the two event times of the first later acknowledgement', () => {
    expect(lines([step(1, AT), event(2, '2026-11-11T10:04:00.000Z', 'acknowledge')])).toEqual([
      'L2 · no acknowledgement · Asha · Push · acknowledged after 4 min',
    ]);
    // whichever wrote it (a ticket acknowledge or an escalation acknowledge), the first later one answers
    expect(
      lines([
        step(1, AT),
        event(2, '2026-11-11T10:02:00.000Z', 'escalation_ack'),
        event(3, '2026-11-11T10:07:00.000Z', 'acknowledge'),
      ]),
    ).toEqual(['L2 · no acknowledgement · Asha · Push · acknowledged after 2 min']);
    // an acknowledgement before the step is not an answer to it
    expect(lines([event(1, '2026-11-11T09:59:00.000Z', 'acknowledge'), step(2, AT)])).toEqual([
      'L2 · no acknowledgement · Asha · Push',
    ]);
  });

  it('gives each step its own line, even when the same rule repeats', () => {
    const bySeq = escalationLines(
      [step(1, AT), step(2, '2026-11-11T10:30:00.000Z', { attempt: 2 })],
      { 'person-1': 'Asha' },
      t,
    );
    expect([...bySeq.keys()]).toEqual([1, 2]);
  });
});
