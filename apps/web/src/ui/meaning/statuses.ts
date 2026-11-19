import type { NudgeSeverity, NudgeStatus } from '@uptimo/shared';
import type { TicketStatus } from '../../api.js';
import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Eye,
  Info,
} from '../icon.js';
import { STATUS, type StatusDef, type Tone } from '../status/index.js';
import type { StatusRef } from '../meaning.js';
import { NUDGE_WORD } from './strings.js';
import type { Meaning, Tone4 } from './types.js';

/**
 * The seven display tones of `ui/status` folded into the four of the design language: ok is good; warning and
 * hold (waiting on someone) watch; danger is bad; the rest, work in progress, handed over and finished, is
 * neutral (it is neither a win nor a problem).
 */
const TONE_OF: Record<Tone, Tone4> = {
  ok: 'good',
  warning: 'watch',
  hold: 'watch',
  danger: 'bad',
  info: 'neutral',
  moved: 'neutral',
  muted: 'neutral',
};

/** The status a ticket's own state shows as; an unstarted ticket is "Booked" (`StatusBadge`). */
export const WORK_STATUS: Record<TicketStatus, StatusRef> = {
  open: { group: 'floor', id: 'booked' },
  working: { group: 'ticket', id: 'in_progress' },
  waiting: { group: 'ticket', id: 'waiting' },
  closed: { group: 'ticket', id: 'closed' },
  cancelled: { group: 'ticket', id: 'cancelled' },
};

/** Every status and severity of `ui/status`, as the one meaning shape. */
export function statusMeaningOf({ group, id }: StatusRef): Meaning {
  const def = (STATUS[group] as Record<string, StatusDef>)[id]!;
  return { tone: TONE_OF[def.tone], icon: def.icon, key: def.label };
}

export function workStatusMeaning(status: TicketStatus): Meaning {
  return statusMeaningOf(WORK_STATUS[status]);
}

/** Action Center nudges carry their own severity (high to info) and status. */
export const NUDGE_SEVERITY: Record<NudgeSeverity, Meaning> = {
  high: { tone: 'bad', icon: ChevronsUp, word: NUDGE_WORD.severity.high },
  med: { tone: 'watch', icon: ChevronUp, word: NUDGE_WORD.severity.med },
  low: { tone: 'neutral', icon: ChevronDown, word: NUDGE_WORD.severity.low },
  info: { tone: 'neutral', icon: Info, word: NUDGE_WORD.severity.info },
};

export const NUDGE_STATUS: Record<NudgeStatus, Meaning> = {
  open: { tone: 'watch', icon: Bell, word: NUDGE_WORD.status.open },
  ack: { tone: 'neutral', icon: Eye, word: NUDGE_WORD.status.ack },
  snoozed: { tone: 'neutral', icon: BellOff, word: NUDGE_WORD.status.snoozed },
  resolved: { tone: 'good', icon: CheckCheck, word: NUDGE_WORD.status.resolved },
};
