import type { StatusDef } from './index.js';
import { FilePen, RefreshCw, Wifi, WifiOff } from '../icon.js';

export const sync = {
  online: { tone: 'muted', icon: Wifi, label: 'status.sync.online' },
  offline: { tone: 'hold', icon: WifiOff, label: 'status.sync.offline' },
  sending: { tone: 'info', icon: RefreshCw, label: 'status.sync.sending' },
  draft: { tone: 'warning', icon: FilePen, label: 'status.sync.draft' },
} satisfies Record<string, StatusDef>;
