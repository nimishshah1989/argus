import type { StatusDef } from './index.js';
import { CalendarCheck, CalendarClock, CalendarX } from '../icon.js';

export const pm = {
  due: { tone: 'warning', icon: CalendarClock, label: 'status.pm.due' },
  overdue: { tone: 'danger', icon: CalendarX, label: 'status.pm.overdue' },
  done: { tone: 'ok', icon: CalendarCheck, label: 'status.pm.done' },
} satisfies Record<string, StatusDef>;
