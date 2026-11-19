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
  // Owner ruling: a running machine is grey, not green; nothing is wrong, nothing is won.
  const tone = group === 'ticket' && id === 'running' ? 'neutral' : TONE_OF[def.tone];
  return { tone, icon: def.icon, key: def.label };
}

/** A handed-over open ticket is "Transferred", like `StatusBadge`. */
export function workStatusMeaning(status: TicketStatus, handedOver = false): Meaning {
  if (status === 'open' && handedOver)
    return statusMeaningOf({ group: 'ticket', id: 'transferred' });
  return statusMeaningOf(WORK_STATUS[status]);
}

/** Action Center nudges carry (their words are the Action Center's own; `info` is its "Good news") their own severity (high to info) and status. */
export const NUDGE_SEVERITY: Record<NudgeSeverity, Meaning> = {
  high: { tone: 'bad', icon: ChevronsUp, key: 'analytics.actionCenter.tile.high' },
  med: { tone: 'watch', icon: ChevronUp, key: 'analytics.actionCenter.tile.med' },
  low: { tone: 'neutral', icon: ChevronDown, key: 'analytics.actionCenter.tile.low' },
  info: { tone: 'good', icon: Info, key: 'analytics.actionCenter.tile.info' },
};

export const NUDGE_STATUS: Record<NudgeStatus, Meaning> = {
  open: { tone: 'watch', icon: Bell, key: 'analytics.actionCenter.tab.open' },
  ack: { tone: 'neutral', icon: Eye, key: 'analytics.actionCenter.status.ack' },
  snoozed: { tone: 'neutral', icon: BellOff, key: 'analytics.actionCenter.status.snoozed' },
  resolved: { tone: 'good', icon: CheckCheck, key: 'analytics.actionCenter.status.resolved' },
};
