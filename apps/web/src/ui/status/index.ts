import type { MessageKey } from '@uptimo/shared/i18n';
import type { IconComponent } from '../icon.js';
import { clock } from './clock.js';
import { forecast } from './forecast.js';
import { handback } from './handback.js';
import { pm } from './pm.js';
import { severity } from './severity.js';
import { sync } from './sync.js';
import { ticket } from './ticket.js';

export type Tone = 'danger' | 'info' | 'warning' | 'hold' | 'moved' | 'ok' | 'muted';

export interface StatusDef {
  tone: Tone;
  icon: IconComponent;
  label: MessageKey;
}

export const STATUS = { ticket, severity, clock, handback, pm, forecast, sync };
export type StatusGroup = keyof typeof STATUS;
export type StatusId<G extends StatusGroup> = keyof (typeof STATUS)[G] & string;
