import type { StatusDef } from './index.js';
import { Eye, Flame, ShieldCheck } from '../icon.js';

export const forecast = {
  hot: { tone: 'danger', icon: Flame, label: 'status.forecast.hot' },
  watch: { tone: 'warning', icon: Eye, label: 'status.forecast.watch' },
  normal: { tone: 'muted', icon: ShieldCheck, label: 'status.forecast.normal' },
} satisfies Record<string, StatusDef>;
