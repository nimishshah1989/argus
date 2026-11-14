/**
 * The proposed starting ladder for a plant (ticket 29, ruling d). The real answers (who is on the ladder, the delays,
 * the repeats) are Nimish's, two weeks after cutover; until then these are the defaults the head can change on the
 * ladder screen (ticket 31). Levels are told by role: L2 supervisor, L3 head, L4 plant head. A repeat is every
 * `repeatMinutes` (never under 15) at most `repeatCap` times.
 */
export interface EscalationRuleDefault {
  trigger:
    | 'ack_missed'
    | 'restore_missed'
    | 'pause_overrun'
    | 'reopened_twice'
    | 'critical_still_down'
    | 'handback_unanswered';
  severityMin: 'S1' | 'S2' | 'S3' | 'S4';
  level: 'L2' | 'L3' | 'L4';
  notifyRole: 'supervisor' | 'head' | 'plant_head';
  channel: 'push';
  delayMinutes: number;
  repeatMinutes: number | null;
  repeatCap: number | null;
}

export const ESCALATION_DEFAULTS: readonly EscalationRuleDefault[] = [
  {
    trigger: 'ack_missed',
    severityMin: 'S3',
    level: 'L2',
    notifyRole: 'supervisor',
    channel: 'push',
    delayMinutes: 0,
    repeatMinutes: 30,
    repeatCap: 3,
  },
  {
    trigger: 'restore_missed',
    severityMin: 'S3',
    level: 'L3',
    notifyRole: 'head',
    channel: 'push',
    delayMinutes: 0,
    repeatMinutes: 30,
    repeatCap: 3,
  },
  {
    trigger: 'critical_still_down',
    severityMin: 'S1',
    level: 'L4',
    notifyRole: 'plant_head',
    channel: 'push',
    delayMinutes: 60,
    repeatMinutes: 60,
    repeatCap: 3,
  },
  {
    trigger: 'pause_overrun',
    severityMin: 'S3',
    level: 'L2',
    notifyRole: 'supervisor',
    channel: 'push',
    delayMinutes: 0,
    repeatMinutes: null,
    repeatCap: null,
  },
  {
    trigger: 'reopened_twice',
    severityMin: 'S3',
    level: 'L3',
    notifyRole: 'head',
    channel: 'push',
    delayMinutes: 0,
    repeatMinutes: null,
    repeatCap: null,
  },
  {
    trigger: 'handback_unanswered',
    severityMin: 'S3',
    level: 'L2',
    notifyRole: 'supervisor',
    channel: 'push',
    delayMinutes: 0,
    repeatMinutes: 30,
    repeatCap: 2,
  },
];
