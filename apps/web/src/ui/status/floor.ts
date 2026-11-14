import type { StatusDef } from './index.js';
import { CircleCheck, Clock, Wrench } from '../icon.js';

/** What the floor calls a ticket's progress ("My complaints"). The desk keeps its own ticket words. */
export const floor = {
  booked: { tone: 'hold', icon: Clock, label: 'status.floor.booked' },
  in_progress: { tone: 'info', icon: Wrench, label: 'status.floor.inProgress' },
  fixed: { tone: 'ok', icon: CircleCheck, label: 'status.floor.fixed' },
} satisfies Record<string, StatusDef>;
