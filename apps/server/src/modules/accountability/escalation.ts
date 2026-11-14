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
import { activeRulesFor, clockStillRunning, rosterPersonIds, ruleById } from './repo/escalation.js';
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

/**
 * Who is told: a named person if they are still on, otherwise the people on the roster for the shift running now at
 * the rule's level, otherwise every active person with the role who has a personal login. Off or inactive people never.
 */
async function recipients(
  client: PoolClient,
  tenantId: string,
  rule: RuleRow,
  at: Date,
): Promise<string[]> {
  const active = new Set((await activePeople(client, tenantId)).map((person) => person.id));
  if (rule.notify_person_id)
    return active.has(rule.notify_person_id) ? [rule.notify_person_id] : [];
  const zone = (await tenantInfo(client, tenantId))?.time_zone ?? null;
  const shift = await shiftNowAt(client, zone, at);
  if (shift) {
    const onDuty = await rosterPersonIds(client, tenantId, {
      date: shift.day,
      shiftId: shift.id,
      level: rule.level,
    });
    const stillOn = onDuty.filter((id) => active.has(id));
    if (stillOn.length > 0) return stillOn;
  }
  return peopleWithRole(client, tenantId, [rule.notify_role as string]);
}

/** Whether the condition the rule answers is still true: a clock that has not stopped, a machine still down. */
async function conditionHolds(
  client: PoolClient,
  job: EscalationJob,
  rule: RuleRow,
  facts: DownFacts,
): Promise<boolean> {
  if (!severityAtLeast(facts.severity, rule.severity_min)) return false;
  if (job.trigger === 'critical_still_down') {
    return (
      facts.kind === 'stopped' &&
      ACTIVE.includes(facts.status) &&
      !facts.machineRunning &&
      facts.downSince.getTime() === job.episode
    );
  }
  const kind = CLOCK_OF[job.trigger];
  if (!kind) return false;
  return clockStillRunning(client, job.tenantId, job.ticketId, {
    kind,
    firedAt: new Date(job.episode),
  });
}

/**
 * Sends one step if the rule is still on, the condition still holds and nobody acknowledged: tells the people, writes
 * the history event and queues the repeat. Run twice it does the step once (the event key is unique per ticket and
 * the message key per person). Returns whether it sent.
 */
export async function runEscalationStep(
  client: PoolClient,
  boss: PgBoss | null,
  job: EscalationJob,
  now: Date,
): Promise<boolean> {
  if (!(await lockTicket(client, job.tenantId, job.ticketId))) return false;
  const rule = await ruleById(client, job.ruleId);
  if (!rule?.active || rule.trigger !== job.trigger) return false;
  if (await escalationStepDone(client, job.ticketId, stepKey(job))) return false;
  const facts = await ticketDownFacts(client, job.tenantId, job.ticketId);
  if (!facts || !(await conditionHolds(client, job, rule, facts))) return false;
  if (chainAcknowledged(await loadEvents(client, job.ticketId), job.ruleId, job.episode))
    return false;
  const told = await recipients(client, job.tenantId, rule, now);
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
    channels: [rule.channel],
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
