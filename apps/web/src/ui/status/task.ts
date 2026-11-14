import type { StatusDef } from './index.js';
import { AlarmClock, CircleCheck, Clock, Wrench } from '../icon.js';

/** A task with no date never turns Overdue (slice 4, X1). */
export const task = {
  pending: { tone: 'hold', icon: Clock, label: 'status.task.pending' },
  overdue: { tone: 'danger', icon: AlarmClock, label: 'status.task.overdue' },
  in_progress: { tone: 'info', icon: Wrench, label: 'status.task.inProgress' },
  done: { tone: 'ok', icon: CircleCheck, label: 'status.task.done' },
} satisfies Record<string, StatusDef>;
