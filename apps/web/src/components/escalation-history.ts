import type { TFunction } from 'i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { TicketEvent } from '../api.js';
import { formatMinutes } from './format.js';

/** A step's payload as the reply carries it (the shared schema behind the ticket event). */
type EscalationStep = NonNullable<TicketEvent['escalation']>;

/** The words a plant reads for why a rule fired (a rule's own `trigger` is a code, not copy). */
const TRIGGERS: Record<string, MessageKey> = {
  ack_missed: 'escalation.trigger.ackMissed',
  restore_missed: 'escalation.trigger.restoreMissed',
  pause_overrun: 'escalation.trigger.pauseOverrun',
  reopened_twice: 'escalation.trigger.reopenedTwice',
  critical_still_down: 'escalation.trigger.criticalStillDown',
  handback_unanswered: 'escalation.trigger.handbackUnanswered',
};

const CHANNELS: Record<string, MessageKey> = {
  push: 'escalation.channel.push',
  whatsapp: 'escalation.channel.whatsapp',
};

/** The first acknowledgement that answered a step: the first later `acknowledge` or `escalation_ack` row. */
function answeredAfter(events: readonly TicketEvent[], index: number): number | null {
  const stepAt = new Date(events[index]!.at).getTime();
  for (const event of events.slice(index + 1)) {
    if (event.type !== 'acknowledge' && event.type !== 'escalation_ack') continue;
    return Math.max(0, Math.floor((new Date(event.at).getTime() - stepAt) / 60_000));
  }
  return null;
}

function toldNames(step: EscalationStep, names: Record<string, string>): string | null {
  const named = (step.toldPersonIds ?? []).flatMap((id) => {
    const name = names[id];
    return name ? [name] : [];
  });
  return named.length > 0 ? named.join(', ') : null;
}

function channelText(channel: string, fallback: string | undefined, t: TFunction): string {
  const name = CHANNELS[fallback ?? channel];
  const text = name ? t(name) : (fallback ?? channel);
  return fallback ? t('escalation.channel.fallback', { channel: text }) : text;
}

/** One line per `escalate` event, keyed by its seq: what fired, who was told, how, and how fast it was answered. */
export function escalationLines(
  events: readonly TicketEvent[],
  names: Record<string, string>,
  t: TFunction,
): Map<number, string> {
  const lines = new Map<number, string>();
  events.forEach((event, index) => {
    const step = event.type === 'escalate' ? event.escalation : null;
    if (!step) return;
    if (step.noLadder) {
      lines.set(event.seq, t('escalation.nobodyTold'));
      return;
    }
    const minutes = answeredAfter(events, index);
    const parts = [
      step.attempt > 1 ? t('escalation.repeat', { attempt: step.attempt }) : null,
      t('escalation.line.level', {
        level: step.level,
        trigger: TRIGGERS[step.trigger] ? t(TRIGGERS[step.trigger]!) : step.trigger,
      }),
      toldNames(step, names),
      channelText(step.channel, step.channelFallback, t),
      minutes === null ? null : t('escalation.acknowledgedAfter', { time: formatMinutes(minutes) }),
    ].filter((part): part is string => Boolean(part));
    lines.set(event.seq, parts.join(' · '));
  });
  return lines;
}
