import type { StatusDef } from './index.js';
import { AlarmClock, CircleStop, Clock, Pause, TriangleAlert } from '../icon.js';

export const clock = {
  ok: { tone: 'muted', icon: Clock, label: 'status.clock.ok' },
  due_soon: { tone: 'warning', icon: AlarmClock, label: 'status.clock.dueSoon' },
  overdue: { tone: 'danger', icon: TriangleAlert, label: 'status.clock.overdue' },
  paused: { tone: 'hold', icon: Pause, label: 'status.clock.paused' },
  stopped: { tone: 'muted', icon: CircleStop, label: 'status.clock.stopped' },
} satisfies Record<string, StatusDef>;
