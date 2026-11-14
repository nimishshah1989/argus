import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import {
  chainAcknowledged,
  CLOCK_TRIGGER,
  reopenEpisode,
  repeatAfterMinutes,
  severityAtLeast,
  type EscalationTrigger,
} from '@uptimo/domain';
import { withTenant } from '@uptimo/db';
import { jobDb, type TicketWrite } from '../../kernel/index.js';
import { peopleWithRole, tenantInfo } from '../identity/index.js';
import { shiftNowAt } from '../plant/index.js';
import { notify } from '../notifications/index.js';
import {
  appendEscalationEvent,
  escalationStepDone,
  loadEvents,
  lockTicket,
  ticketDownFacts,
  type DownFacts,
} from '../tickets/index.js';
import { ensureEscalationDefaults } from './ladder.js';
import { activeRulesFor, clockStateAt, rosterPersonIds, ruleById } from './repo/escalation.js';
import { plantHasPolicies } from './repo/policies.js';
import type { RuleRow } from './repo/escalation.js';
import type { SlaTimerKind } from './repo/timers.js';

export const ESCALATION_QUEUE = 'sla.escalate';
const MINUTE_MS = 60_000;
const ACTIVE = ['open', 'working', 'waiting'];

const CLOCK_OF: Partial<Record<EscalationTrigger, SlaTimerKind>> = {
  ack_missed: 'ack',
  restore_missed: 'restore',
  pause_overrun: 'pause',
  handback_unanswered: 'handback',
};

/** Triggers raised by something that happened to the ticket, not by a clock. */
const EVENT_TRIGGERS: readonly EscalationTrigger[] = ['critical_still_down', 'reopened_twice'];

/**
 * One step of one rule on one ticket. `episode` names the run (the moment the clock breached, or the moment the
 * machine went down) so a later run of the same rule is a new chain; `attempt` 1 is the first notice, the rest repeats.
 */
export interface EscalationJob {
  tenantId: string;
  ticketId: string;
  ruleId: string;
  trigger: EscalationTrigger;
  episode: number;
  attempt: number;
  dueAt: number;
}

const stepKey = (job: EscalationJob) => `esc:${job.ruleId}:${job.episode}:${job.attempt}`;

async function schedule(client: PoolClient, boss: PgBoss, job: EscalationJob): Promise<void> {
  await boss.upsert({
    name: ESCALATION_QUEUE,
    data: job,
    options: {
      singletonKey: `${job.tenantId}:${job.ticketId}:${stepKey(job)}`,
      startAfter: new Date(job.dueAt),
      db: jobDb(client),
    },
  });
}

/** Every role that signs in as a person: a roster line or a role names someone only if they have a login of their own. */
const ALL_ROLES = ['operator', 'technician', 'supervisor', 'head', 'plant_head', 'admin', 'board'];

/**
 * Who is told: a named person if they are still on, otherwise the people on the roster for the shift running now at
 * the rule's level, otherwise every active person with the role. All of them need a login of their own (a push goes
 * to a person). If that is nobody, the plant head, the heads and the admins are told and the step says there was no ladder: a
 * critical machine never escalates to nobody.
 */
async function recipients(
  client: PoolClient,
  tenantId: string,
  rule: RuleRow,
  at: Date,
): Promise<{ ids: string[]; noLadder: boolean }> {
  const withLogin = new Set(await peopleWithRole(client, tenantId, ALL_ROLES));
  if (rule.notify_person_id && withLogin.has(rule.notify_person_id))
    return { ids: [rule.notify_person_id], noLadder: false };
  const zone = (await tenantInfo(client, tenantId))?.time_zone ?? null;
  const shift = await shiftNowAt(client, zone, at);
  if (shift) {
    const onDuty = await rosterPersonIds(client, tenantId, {
      date: shift.day,
      shiftId: shift.id,
      level: rule.level,
    });
    const stillOn = onDuty.filter((id) => withLogin.has(id));
    if (stillOn.length > 0) return { ids: stillOn, noLadder: false };
  }
  if (rule.notify_role) {
    const byRole = await peopleWithRole(client, tenantId, [rule.notify_role]);
    if (byRole.length > 0) return { ids: byRole, noLadder: false };
  }
  return {
    ids: await peopleWithRole(client, tenantId, ['plant_head', 'head', 'admin']),
    noLadder: true,
  };
}

type Holds = 'yes' | 'paused' | 'no';

/** Not a clock: it holds while the ticket is back at work from this very dispute. */
function reopenHolds(
  facts: DownFacts,
  events: readonly { type: string; at: Date }[],
  episode: number,
): Holds {
  return ACTIVE.includes(facts.status) && reopenEpisode(events) === episode ? 'yes' : 'no';
}

/** Whether the condition the rule answers is still true: a clock still going (or paused), a machine still down. */
async function conditionHolds(
  client: PoolClient,
  job: EscalationJob,
  rule: RuleRow,
  seen: { facts: DownFacts; events: readonly { type: string; at: Date }[] },
): Promise<Holds> {
  const { facts, events } = seen;
  if (!severityAtLeast(facts.severity, rule.severity_min)) return 'no';
  if (job.trigger === 'reopened_twice') return reopenHolds(facts, events, job.episode);
  if (job.trigger === 'critical_still_down') {
    const down =
      facts.kind === 'stopped' &&
      ACTIVE.includes(facts.status) &&
      !facts.machineRunning &&
      facts.downSince.getTime() === job.episode;
    return down ? 'yes' : 'no';
  }
  const kind = CLOCK_OF[job.trigger];
  if (!kind) return 'no';
  const state = await clockStateAt(client, job.tenantId, job.ticketId, {
    kind,
    firedAt: new Date(job.episode),
  });
  return state === 'running' ? 'yes' : state === 'paused' ? 'paused' : 'no';
}

/**
 * Sends one step if the rule is still on, the condition still holds and nobody acknowledged: tells the people, writes
 * the history event and queues the repeat. Run twice it does the step once (the event key is unique per ticket and
 * the message key per person). Returns whether it sent.
 */
/** The rule and whether its condition holds, or null when this step has nothing to do. */
async function stepGate(
  client: PoolClient,
  job: EscalationJob,
): Promise<{ rule: RuleRow; holds: Holds } | null> {
  if (!(await lockTicket(client, job.tenantId, job.ticketId))) return null;
  if (!(await plantHasPolicies(client))) return null;
  const rule = await ruleById(client, job.ruleId);
  if (!rule?.active || rule.trigger !== job.trigger) return null;
  if (await escalationStepDone(client, job.ticketId, stepKey(job))) return null;
  const facts = await ticketDownFacts(client, job.tenantId, job.ticketId);
  if (!facts) return null;
  const events = await loadEvents(client, job.ticketId);
  const holds = await conditionHolds(client, job, rule, { facts, events });
  if (holds === 'no') return null;
  return chainAcknowledged(events, job.ruleId, job.episode) ? null : { rule, holds };
}

export async function runEscalationStep(
  client: PoolClient,
  boss: PgBoss | null,
  job: EscalationJob,
  now: Date,
): Promise<boolean> {
  const gate = await stepGate(client, job);
  if (!gate) return false;
  const { rule, holds } = gate;
  // The first notice honours the rule as it is now: a delay raised since this was queued waits longer.
  const first = job.episode + rule.delay_minutes * MINUTE_MS;
  if (job.attempt === 1 && now.getTime() < first) {
    if (boss) await schedule(client, boss, { ...job, dueAt: first });
    return false;
  }
  if (holds === 'paused') {
    // Waiting on a part is not the end of the chain: ask again after a repeat's wait (a rule that never repeats
    // waits its own delay, 15 minutes at least), without using up an attempt.
    const wait = rule.repeat_minutes ?? Math.max(rule.delay_minutes, 15);
    if (boss) await schedule(client, boss, { ...job, dueAt: now.getTime() + wait * MINUTE_MS });
    return false;
  }
  return sendStep(client, boss, { job, rule, now });
}

async function sendStep(
  client: PoolClient,
  boss: PgBoss | null,
  step: { job: EscalationJob; rule: RuleRow; now: Date },
): Promise<boolean> {
  const { job, rule, now } = step;
  const { ids: told, noLadder } = await recipients(client, job.tenantId, rule, now);
  // No WhatsApp sender exists yet: the step goes out as a push and the event says so.
  const fallback = rule.channel === 'whatsapp';
  const eventId = await appendEscalationEvent(client, {
    tenantId: job.tenantId,
    ticketId: job.ticketId,
    at: now,
    key: stepKey(job),
    escalation: {
      ruleId: rule.id,
      trigger: rule.trigger,
      episode: job.episode,
      level: rule.level,
      attempt: job.attempt,
      channel: rule.channel,
      toldCount: told.length,
      ...(noLadder ? { noLadder: true } : {}),
      ...(fallback ? { channelFallback: 'push' } : {}),
    },
  });
  if (!eventId) return false;
  await notify(client, boss, {
    tenantId: job.tenantId,
    ticketId: job.ticketId,
    eventId,
    now,
    to: told,
    kind: 'escalation.step',
    channels: ['push'],
    dedupeKey: `${job.ticketId}:${stepKey(job)}`,
  });
  const wait = repeatAfterMinutes(
    { repeatMinutes: rule.repeat_minutes, repeatCap: rule.repeat_cap },
    job.attempt,
  );
  if (wait !== null && boss) {
    const dueAt = now.getTime() + wait * MINUTE_MS;
    await schedule(client, boss, { ...job, attempt: job.attempt + 1, dueAt });
  }
  return true;
}

/** Starts one chain per switched-on rule for `trigger` that covers the ticket's severity; a step due now goes out now. */
async function startChains(
  client: PoolClient,
  boss: PgBoss | null,
  input: {
    tenantId: string;
    ticketId: string;
    trigger: EscalationTrigger;
    episode: number;
    now: Date;
  },
): Promise<void> {
  const { tenantId, ticketId, trigger, episode, now } = input;
  if (!(await plantHasPolicies(client))) return;
  await ensureEscalationDefaults(client, { tenantId, loginId: null });
  const facts = await ticketDownFacts(client, tenantId, ticketId);
  if (!facts) return;
  for (const rule of await activeRulesFor(client, trigger)) {
    if (!severityAtLeast(facts.severity, rule.severity_min)) continue;
    const dueAt = episode + rule.delay_minutes * MINUTE_MS;
    const job: EscalationJob = {
      tenantId,
      ticketId,
      ruleId: rule.id,
      trigger,
      episode,
      attempt: 1,
      dueAt,
    };
    if (dueAt <= now.getTime()) await runEscalationStep(client, boss, job, now);
    else if (boss) await schedule(client, boss, job);
  }
}

/** Starts the chains of a clock that just breached: each switched-on rule for it that covers the ticket's severity. */
export async function startClockEscalation(
  client: PoolClient,
  boss: PgBoss | null,
  input: { tenantId: string; ticketId: string; kind: SlaTimerKind; firedAt: Date },
): Promise<void> {
  const { tenantId, ticketId, firedAt } = input;
  const trigger = CLOCK_TRIGGER[input.kind];
  await startChains(client, boss, {
    tenantId,
    ticketId,
    trigger,
    episode: firedAt.getTime(),
    now: firedAt,
  });
}

/**
 * Production sent the fix back for the second time (or more): the dispute that just happened starts one
 * `reopened_twice` chain. Only the write of the dispute itself starts it (a replayed command never reaches here), so a
 * rule switched on later does not reach back to tickets reopened before.
 */
export async function startReopenEscalation(client: PoolClient, write: TicketWrite): Promise<void> {
  if (write.command !== 'handback') return;
  const events = await loadEvents(client, write.ticketId);
  const answer = events
    .filter((e) => e.type === 'handback_dispute' || e.type === 'handback_confirm')
    .at(-1);
  const episode = reopenEpisode(events);
  if (answer?.type !== 'handback_dispute' || episode === null) return;
  const now = new Date(Math.max(write.now.getTime(), episode));
  await startChains(client, write.boss ?? null, {
    tenantId: write.tenantId,
    ticketId: write.ticketId,
    trigger: 'reopened_twice',
    episode,
    now,
  });
}

/**
 * A breakdown that is still down is not a clock: it is armed whenever the ticket is written (and by the nightly
 * check), due `delay_minutes` after the machine went down. A step that already ran is not queued again.
 */
export async function armDownEscalation(
  client: PoolClient,
  boss: PgBoss,
  input: { tenantId: string; ticketId: string },
): Promise<void> {
  const { tenantId, ticketId } = input;
  const facts = await ticketDownFacts(client, tenantId, ticketId);
  if (!facts || facts.kind !== 'stopped' || facts.machineRunning || !ACTIVE.includes(facts.status))
    return;
  if (!(await plantHasPolicies(client))) return;
  await ensureEscalationDefaults(client, { tenantId, loginId: null });
  for (const rule of await activeRulesFor(client, 'critical_still_down')) {
    if (!severityAtLeast(facts.severity, rule.severity_min)) continue;
    const job: EscalationJob = {
      tenantId,
      ticketId,
      ruleId: rule.id,
      trigger: 'critical_still_down',
      episode: facts.downSince.getTime(),
      attempt: 1,
      dueAt: facts.downSince.getTime() + rule.delay_minutes * MINUTE_MS,
    };
    if (!(await escalationStepDone(client, ticketId, stepKey(job))))
      await schedule(client, boss, job);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertJob(job: EscalationJob): void {
  const ids = [job.tenantId, job.ticketId, job.ruleId];
  const numbers = [job.episode, job.dueAt];
  if (
    !ids.every((id) => UUID.test(id)) ||
    !numbers.every(Number.isFinite) ||
    !Number.isInteger(job.attempt) ||
    job.attempt < 1 ||
    !(job.trigger in CLOCK_OF || EVENT_TRIGGERS.includes(job.trigger))
  )
    throw new Error('Invalid escalation job');
}

export interface EscalationRuntime {
  pool: Pool;
  now: () => Date;
  boss: PgBoss;
}

/** A job that wakes before its time (clock skew) is queued again for its time and does nothing now. */
export async function processEscalationJob(
  job: EscalationJob,
  runtime: EscalationRuntime,
): Promise<boolean> {
  assertJob(job);
  const now = runtime.now();
  return withTenant(runtime.pool, job.tenantId, async (client) => {
    if (now.getTime() < job.dueAt) {
      await schedule(client, runtime.boss, job);
      return false;
    }
    return runEscalationStep(client, runtime.boss, job, now);
  });
}
