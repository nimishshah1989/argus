import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import {
  chainAcknowledged,
  CLOCK_TRIGGER,
  repeatAfterMinutes,
  severityAtLeast,
  type EscalationTrigger,
} from '@uptimo/domain';
import { withTenant } from '@uptimo/db';
import { jobDb } from '../../kernel/index.js';
import { activePeople, peopleWithRole, tenantInfo } from '../identity/index.js';
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
 * to a person). If that is nobody, the plant's heads and admins are told and the step says there was no ladder: a
 * critical machine never escalates to nobody.
 */
async function recipients(
  client: PoolClient,
  tenantId: string,
  rule: RuleRow,
  at: Date,
): Promise<{ ids: string[]; noLadder: boolean }> {
  const withLogin = new Set(await peopleWithRole(client, tenantId, ALL_ROLES));
  if (rule.notify_person_id) {
    const active = new Set((await activePeople(client, tenantId)).map((person) => person.id));
    if (active.has(rule.notify_person_id)) return { ids: [rule.notify_person_id], noLadder: false };
  }
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
  return { ids: await peopleWithRole(client, tenantId, ['head', 'admin']), noLadder: true };
}

type Holds = 'yes' | 'paused' | 'no';

/** Whether the condition the rule answers is still true: a clock still going (or paused), a machine still down. */
async function conditionHolds(
  client: PoolClient,
  job: EscalationJob,
  rule: RuleRow,
  facts: DownFacts,
): Promise<Holds> {
  if (!severityAtLeast(facts.severity, rule.severity_min)) return 'no';
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
  const holds = await conditionHolds(client, job, rule, facts);
  if (holds === 'no') return null;
  const events = await loadEvents(client, job.ticketId);
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
    // Waiting on a part is not the end of the chain: ask again after a repeat's wait, without using up an attempt.
    if (boss && rule.repeat_minutes !== null)
      await schedule(client, boss, {
        ...job,
        dueAt: now.getTime() + rule.repeat_minutes * MINUTE_MS,
      });
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

/** Starts the chains of a clock that just breached: each switched-on rule for it that covers the ticket's severity. */
export async function startClockEscalation(
  client: PoolClient,
  boss: PgBoss | null,
  input: { tenantId: string; ticketId: string; kind: SlaTimerKind; firedAt: Date },
): Promise<void> {
  const { tenantId, ticketId, firedAt } = input;
  if (!(await plantHasPolicies(client))) return;
  await ensureEscalationDefaults(client, { tenantId, loginId: null });
  const facts = await ticketDownFacts(client, tenantId, ticketId);
  if (!facts) return;
  const trigger = CLOCK_TRIGGER[input.kind];
  for (const rule of await activeRulesFor(client, trigger)) {
    if (!severityAtLeast(facts.severity, rule.severity_min)) continue;
    const dueAt = firedAt.getTime() + rule.delay_minutes * MINUTE_MS;
    const job: EscalationJob = {
      tenantId,
      ticketId,
      ruleId: rule.id,
      trigger,
      episode: firedAt.getTime(),
      attempt: 1,
      dueAt,
    };
    if (dueAt <= firedAt.getTime()) await runEscalationStep(client, boss, job, firedAt);
    else if (boss) await schedule(client, boss, job);
  }
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
    !(job.trigger in CLOCK_OF || job.trigger === 'critical_still_down')
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
