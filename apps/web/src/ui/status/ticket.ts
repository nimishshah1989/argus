import type { StatusDef } from './index.js';
import {
  ArrowRightLeft,
  Ban,
  CheckCheck,
  CircleCheck,
  Hourglass,
  LifeBuoy,
  OctagonX,
  Wrench,
} from '../icon.js';

export const ticket = {
  stopped: { tone: 'danger', icon: OctagonX, label: 'status.ticket.stopped' },
  in_progress: { tone: 'info', icon: Wrench, label: 'status.ticket.inProgress' },
  support: { tone: 'warning', icon: LifeBuoy, label: 'status.ticket.support' },
  waiting: { tone: 'hold', icon: Hourglass, label: 'status.ticket.waiting' },
  transferred: { tone: 'moved', icon: ArrowRightLeft, label: 'status.ticket.transferred' },
  running: { tone: 'muted', icon: CircleCheck, label: 'status.ticket.running' },
  closed: { tone: 'muted', icon: CheckCheck, label: 'status.ticket.closed' },
  cancelled: { tone: 'muted', icon: Ban, label: 'status.ticket.cancelled' },
} satisfies Record<string, StatusDef>;
