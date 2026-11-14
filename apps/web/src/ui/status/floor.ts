import type { StatusDef } from './index.js';
import { CircleCheck, CircleHelp, Clock, ThumbsUp, TimerOff, Wrench } from '../icon.js';

/** What the floor calls a ticket's progress ("My complaints"). The desk keeps its own ticket words. */
export const floor = {
  booked: { tone: 'hold', icon: Clock, label: 'status.floor.booked' },
  in_progress: { tone: 'info', icon: Wrench, label: 'status.floor.inProgress' },
  fixed: { tone: 'ok', icon: CircleCheck, label: 'status.floor.fixed' },
  is_it_fixed: { tone: 'info', icon: CircleHelp, label: 'status.floor.isItFixed' },
  confirmed: { tone: 'ok', icon: ThumbsUp, label: 'status.floor.confirmed' },
  no_answer: { tone: 'muted', icon: TimerOff, label: 'status.floor.noAnswer' },
} satisfies Record<string, StatusDef>;
