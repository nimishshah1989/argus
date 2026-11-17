import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { en } from '@uptimo/shared/i18n';
import type { TicketEvent } from '../api.js';
import { escalationLines, escalationLinks, maySetLadder } from './escalation-history.js';

type EscalationStep = NonNullable<TicketEvent['escalation']>;

/** The English catalogue as a plain `t`: the test reads the words a person sees, never the keys. */
const t = ((key: string, vars: Record<string, string | number> = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(vars[name]),
  )) as unknown as TFunction;

type EventOptions = Omit<Partial<TicketEvent>, 'escalation'> & {
  escalation?: Partial<EscalationStep> | null;
};

function event(seq: number, at: string, type: string, options: EventOptions = {}): TicketEvent {
  const { escalation, ...rest } = options;
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
    ...rest,
  };
}

const step = (seq: number, at: string, escalation: Partial<EscalationStep> = {}) =>
  event(seq, at, 'escalate', { escalation });

/** The ladder's own acknowledgement: the level it covered, and who made it. */
const ack = (seq: number, at: string, level: string, personId: string | null = 'person-2') =>
  event(seq, at, 'escalation_ack', {
    escalationLevel: level,
    actingPersonId: personId,
  });

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

  it('names who acknowledged and how fast from the first covering escalation_ack', () => {
    expect(
      lines([step(1, AT), ack(2, '2026-11-11T10:04:00.000Z', 'L2')], {
        'person-1': 'Asha',
        'person-2': 'Bina',
      }),
    ).toEqual(['L2 · no acknowledgement · Asha · Push · acknowledged after 4 min · Bina']);
  });

  it('a higher escalation_ack covers a lower step, a lower one does not cover a higher step', () => {
    const names = { 'person-1': 'Asha', 'person-2': 'Bina' };
    const at = '2026-11-11T10:05:00.000Z';
    expect(lines([step(1, AT, { level: 'L2' }), ack(2, at, 'L3')], names)[0]).toBe(
      'L2 · no acknowledgement · Asha · Push · acknowledged after 5 min · Bina',
    );
    expect(lines([step(1, AT, { level: 'L3' }), ack(2, at, 'L2')], names)).toEqual([
      'L3 · no acknowledgement · Asha · Push',
    ]);
  });

  it("the ticket's plain acknowledge does not answer a step, and a lower ack does not cover it", () => {
    const names = { 'person-1': 'Asha', 'person-2': 'Bina' };
    // the Acknowledge button stops the ack clock; it never clears the ladder
    expect(
      lines([step(1, AT), event(2, '2026-11-11T10:04:00.000Z', 'acknowledge')], names),
    ).toEqual(['L2 · no acknowledgement · Asha · Push']);
    // a lower level never answers a higher step, even when it is the first later ack
    expect(
      lines(
        [
          step(1, AT, { level: 'L3' }),
          ack(2, '2026-11-11T10:02:00.000Z', 'L2'),
          ack(3, '2026-11-11T10:07:00.000Z', 'L3'),
        ],
        names,
      ),
    ).toEqual(['L3 · no acknowledgement · Asha · Push · acknowledged after 7 min · Bina']);
  });

  it('an acknowledgement before the step is not an answer to it', () => {
    expect(
      lines([ack(1, '2026-11-11T09:59:00.000Z', 'L2'), step(2, AT)], {
        'person-1': 'Asha',
        'person-2': 'Bina',
      }),
    ).toEqual(['L2 · no acknowledgement · Asha · Push']);
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

describe('the ladder link', () => {
  /** What the ticket page would hand the history for this role: the helper owns the rule, not the screen. */
  const linkFor = (events: TicketEvent[], role: string | undefined) =>
    escalationLinks(events, maySetLadder(role));

  it('offers "Set the ladder" to a head and an admin on a step that fired with no ladder', () => {
    for (const role of ['head', 'admin']) {
      const link = linkFor([step(1, AT, { noLadder: true })], role).get(1);
      expect(link?.to).toBe('/settings/ladder');
      expect(en[link!.labelKey]).toBe('Set the ladder');
    }
  });

  it('gives a technician the plain line, with no link to settings', () => {
    expect(linkFor([step(1, AT, { noLadder: true })], 'technician').size).toBe(0);
  });

  it('offers no link on an ordinary step, even to an admin', () => {
    expect(linkFor([step(1, AT)], 'admin').size).toBe(0);
  });
});
