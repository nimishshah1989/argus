import type { StatusDef } from './index.js';
import { ChevronDown, ChevronUp, ChevronsUp, Minus } from '../icon.js';

export const severity = {
  S1: { tone: 'danger', icon: ChevronsUp, label: 'status.severity.s1' },
  S2: { tone: 'hold', icon: ChevronUp, label: 'status.severity.s2' },
  S3: { tone: 'warning', icon: Minus, label: 'status.severity.s3' },
  S4: { tone: 'muted', icon: ChevronDown, label: 'status.severity.s4' },
} satisfies Record<string, StatusDef>;
