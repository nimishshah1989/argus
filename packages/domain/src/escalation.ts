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
  /** Seeded switched off when nothing can fire it yet (`reopened_twice`). */
  active?: boolean;
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
    active: false,
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

export type EscalationLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'vendor';
export type EscalationTrigger = EscalationRuleDefault['trigger'];

/** Which rule trigger a missed clock raises. */
export const CLOCK_TRIGGER = {
  ack: 'ack_missed',
  restore: 'restore_missed',
  pause: 'pause_overrun',
  handback: 'handback_unanswered',
} as const satisfies Record<string, EscalationTrigger>;

const SEVERITY_ORDER = ['S1', 'S2', 'S3', 'S4'] as const;

/** S1 is the most severe: a rule "from S3" covers S1, S2 and S3. */
export function severityAtLeast(severity: string, floor: string): boolean {
  const own = SEVERITY_ORDER.indexOf(severity as (typeof SEVERITY_ORDER)[number]);
  const min = SEVERITY_ORDER.indexOf(floor as (typeof SEVERITY_ORDER)[number]);
  return own >= 0 && min >= 0 && own <= min;
}

const LEVEL_RANK: Readonly<Record<EscalationLevel, number>> = {
  vendor: 1,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
};

/** The level a role may acknowledge up to (DOMAIN section 3): technician L1, supervisor L2, head L3, plant head L4, admin all. */
const ROLE_LEVEL: Readonly<Record<string, number>> = {
  technician: 1,
  supervisor: 2,
  head: 3,
  plant_head: 4,
  admin: 4,
};

export function mayAcknowledgeLevel(role: string, level: EscalationLevel): boolean {
  return (ROLE_LEVEL[role] ?? 0) >= LEVEL_RANK[level];
}

/** The history facts the escalation reads: step events carry `payload.escalation`, an acknowledge carries `payload.level`. */
export interface EscalationHistoryEvent {
  type: string;
  payload?: Record<string, unknown>;
}

interface Chain {
  level: EscalationLevel;
  acknowledged: boolean;
}

/** Each chain (one rule in one episode) that has told someone, and whether a later acknowledge at its level covered it. */
function chains(events: readonly EscalationHistoryEvent[]): Map<string, Chain> {
  const found = new Map<string, Chain>();
  for (const event of events) {
    if (event.type === 'escalate') {
      const step = event.payload?.escalation as
        { ruleId: string; episode: number; level: EscalationLevel } | undefined;
      if (!step) continue;
      const key = `${step.ruleId}:${step.episode}`;
      if (!found.has(key)) found.set(key, { level: step.level, acknowledged: false });
    } else if (event.type === 'escalation_ack') {
      const level = event.payload?.level as EscalationLevel | undefined;
      if (!level) continue;
      for (const chain of found.values()) {
        if (LEVEL_RANK[chain.level] <= LEVEL_RANK[level]) chain.acknowledged = true;
      }
    }
  }
  return found;
}

/** Whether someone acknowledged this chain after its first step: its repeats stop. */
export function chainAcknowledged(
  events: readonly EscalationHistoryEvent[],
  ruleId: string,
  episode: number,
): boolean {
  return chains(events).get(`${ruleId}:${episode}`)?.acknowledged ?? false;
}

/** The levels of the chains still waiting for an acknowledge. */
export function pendingEscalationLevels(
  events: readonly EscalationHistoryEvent[],
): EscalationLevel[] {
  return [...chains(events).values()].filter((c) => !c.acknowledged).map((c) => c.level);
}

/**
 * The minutes until the next repeat, or null when the rule does not repeat or the cap is reached. `attempt` is the
 * step just sent (1 is the first notice); the rule repeats `repeatCap` times after it.
 */
export function repeatAfterMinutes(
  rule: { repeatMinutes: number | null; repeatCap: number | null },
  attempt: number,
): number | null {
  if (rule.repeatMinutes === null || rule.repeatCap === null) return null;
  return attempt <= rule.repeatCap ? rule.repeatMinutes : null;
}
