import type { StatusDef } from './index.js';
import { CircleHelp, ThumbsDown, ThumbsUp, TimerOff } from '../icon.js';

export const handback = {
  requested: { tone: 'info', icon: CircleHelp, label: 'status.handback.requested' },
  confirmed: { tone: 'ok', icon: ThumbsUp, label: 'status.handback.confirmed' },
  disputed: { tone: 'danger', icon: ThumbsDown, label: 'status.handback.disputed' },
  timed_out: { tone: 'muted', icon: TimerOff, label: 'status.handback.timedOut' },
} satisfies Record<string, StatusDef>;
