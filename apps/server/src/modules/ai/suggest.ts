import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import {
  aiConsentSchema,
  aiMonthlyCapUsdSchema,
  aiSuggestPayloadSchema,
  type AiOutcome,
  type AiSuggestPayload,
} from '@uptimo/shared';
import { jobDb, withTenant } from '../../kernel/index.js';
import { redactionTerms } from '../identity/index.js';
import { setting } from '../plant/index.js';
import type { AiConfig } from './config.js';
import { costMicroUsd, maxCallCostMicroUsd, monthStartUtc, retryPlan } from './limits.js';
import { AiProviderError, type AiOutputSchema, type AiProvider, type AiUsage } from './provider.js';
import { createRedactor, type AiJson, type Redactor } from './redact.js';
import {
  claimSuggestion,
  markAttempt,
  monthCostMicroUsd,
  settleSuggestion,
  type Settlement,
} from './repo.js';

export const AI_SUGGEST_QUEUE = 'ai.suggest';

export interface AiLoaded {
  task: string;
  input: AiJson;
  /** Evidence key sent to the model -> ticket id; only these may be cited (D22 section 4). */
  evidence?: Record<string, string>;
  /** Facts made by code and stored beside the answer; never sent. */
  facts?: AiJson;
}
export interface AiGrounded {
  output: AiJson;
  evidenceTicketIds: string[];
  dropped: number;
}

export interface AiFeature<T> {
  name: AiSuggestPayload['feature'];
  promptVersion: string;
  outputSchema: AiOutputSchema<T>;
  /** Reads through published functions under the job's tenant; 'stale' when the subject is closed or gone. */
  load(
    tx: Pick<PoolClient, 'query'>,
    tenantId: string,
    subjectId: string,
  ): Promise<AiLoaded | 'stale'>;
  /** Transaction 3, before storing: check the answer against this call's evidence. Absent: stored as returned. */
  ground?(
    tx: Pick<PoolClient, 'query'>,
    tenantId: string,
    output: T,
    loaded: AiLoaded,
  ): Promise<AiGrounded>;
}
export type AiFeatures = Partial<Record<AiSuggestPayload['feature'], AiFeature<unknown>>>;

export interface AiLogLine {
  tenantId: string;
  module: 'ai';
  job: 'ai.suggest';
  feature: string;
  promptVersion: string;
  modelRef: string;
  suggestionId: string | null;
  attempt: number;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  outcome: AiOutcome;
  evidenceDropped: number;
  durationMs: number;
}

export interface AiRuntime {
  pool: Pool;
  boss: Pick<PgBoss, 'send'>;
  config: AiConfig;
  provider: AiProvider | null;
  features: AiFeatures;
  now: () => Date;
  log: (line: AiLogLine) => void;
}

type Prepared = { task: string; redacted: AiJson; redactor: Redactor; loaded: AiLoaded };
type Db = Pick<PoolClient, 'query'>;
type Claimed = { id: string; attempts: number };
/** What the log line learns on the way; the rest is fixed by the payload. */
type Progress = Pick<
  AiLogLine,
  'suggestionId' | 'attempt' | 'inputTokens' | 'outputTokens' | 'costMicroUsd' | 'evidenceDropped'
>;

const NO_USAGE: AiUsage = { inputTokens: 0, outputTokens: 0 };

/** Gates inside transaction 1: production consent, then the monthly cap. Null means pass. */
async function gateProduction(
  tx: Pick<PoolClient, 'query'>,
  tenantId: string,
  config: AiConfig,
): Promise<AiOutcome | null> {
  if (!config.production) return null;
  const consent = aiConsentSchema.safeParse(await setting(tx, tenantId, 'ai.consent'));
  if (!consent.success || consent.data.status !== 'granted') return 'no_consent';
  const cap = aiMonthlyCapUsdSchema.safeParse(await setting(tx, tenantId, 'ai.monthlyCapUsd'));
  return cap.success ? null : 'cap_reached';
}

async function capReached(
  tx: Pick<PoolClient, 'query'>,
  tenantId: string,
  prepared: Prepared,
  rt: AiRuntime,
): Promise<boolean> {
  const set = aiMonthlyCapUsdSchema.safeParse(await setting(tx, tenantId, 'ai.monthlyCapUsd'));
  const capUsd = set.success ? set.data : rt.config.defaultMonthlyCapUsd;
  const spent = await monthCostMicroUsd(tx, tenantId, monthStartUtc(rt.now()));
  const bytes = Buffer.byteLength(prepared.task + JSON.stringify(prepared.redacted));
  return spent + maxCallCostMicroUsd(bytes, rt.config) > capUsd * 1_000_000;
}

/** Transaction 1: gates, load, redact, cap. Reads only; the tenant comes only from the payload. */
async function prepare(
  payload: AiSuggestPayload,
  feature: AiFeature<unknown>,
  rt: AiRuntime,
): Promise<Prepared | AiOutcome> {
  const { tenantId } = payload;
  return withTenant(rt.pool, tenantId, async (tx) => {
    const gated = await gateProduction(tx, tenantId, rt.config);
    if (gated) return gated;
    const loaded = await feature.load(tx, tenantId, payload.subjectId);
    if (loaded === 'stale') return 'stale';
    const redactor = createRedactor(await redactionTerms(tx, tenantId));
    const redacted = redactor.redact(loaded.input);
    const prepared = { task: loaded.task, redacted, redactor, loaded };
    return (await capReached(tx, tenantId, prepared, rt)) ? 'cap_reached' : prepared;
  });
}

function settlement(
  status: Settlement['status'],
  outcome: Settlement['outcome'],
  rt: AiRuntime,
  extra: { output?: AiJson; usage?: AiUsage; evidenceTicketIds?: string[] } = {},
): Settlement {
  const usage = extra.usage ?? NO_USAGE;
  return {
    status,
    outcome,
    output: extra.output ?? null,
    usage,
    costMicroUsd: costMicroUsd(usage, rt.config),
    evidenceTicketIds: extra.evidenceTicketIds ?? [],
    now: rt.now(),
  };
}

/** Transaction 2: claim, then the ceiling and the redaction scan, then count the try. */
async function claim(
  payload: AiSuggestPayload,
  prepared: Prepared,
  provider: AiProvider,
  rt: AiRuntime,
): Promise<{ claimed: Claimed } | { outcome: AiOutcome; id?: string }> {
  const { tenantId } = payload;
  return withTenant(rt.pool, tenantId, async (tx) => {
    const row = await claimSuggestion(tx, {
      tenantId,
      feature: payload.feature,
      subjectType: payload.subjectType,
      subjectId: payload.subjectId,
      ticketId: payload.subjectId,
      promptVersion: payload.promptVersion,
      modelRef: provider.modelRef,
      now: rt.now(),
    });
    if (!row) return { outcome: 'duplicate' as const };
    if (row.attempts >= 4) {
      await settleSuggestion(tx, tenantId, row.id, settlement('failed', 'provider_error', rt));
      return { outcome: 'provider_error' as const, id: row.id };
    }
    const text = prepared.task + '\n' + JSON.stringify(prepared.redacted);
    if (prepared.redactor.leaks(text)) {
      await settleSuggestion(tx, tenantId, row.id, settlement('failed', 'redaction_failed', rt));
      return { outcome: 'redaction_failed' as const, id: row.id };
    }
    const attempts = await markAttempt(tx, tenantId, row.id, rt.now());
    return { claimed: { id: row.id, attempts } };
  });
}

type SettledCall = { output: AiJson; usage: AiUsage; ground?: (tx: Db) => Promise<AiGrounded> };

/** Transaction 3: store the answer, or the failure and, when the table says so, the next try. */
async function settleCall(
  payload: AiSuggestPayload,
  claimed: Claimed,
  result: SettledCall | AiProviderError,
  rt: AiRuntime,
): Promise<AiOutcome> {
  const { tenantId } = payload;
  return withTenant(rt.pool, tenantId, async (tx) => {
    if (!(result instanceof AiProviderError)) {
      const grounded = result.ground
        ? await result.ground(tx)
        : { output: result.output, evidenceTicketIds: [] };
      await settleSuggestion(
        tx,
        tenantId,
        claimed.id,
        settlement('ready', 'ok', rt, {
          output: grounded.output,
          usage: result.usage,
          evidenceTicketIds: grounded.evidenceTicketIds,
        }),
      );
      return 'ok';
    }
    const step = retryPlan(result.code, claimed.attempts, result.retryAfterSeconds);
    const status = step.kind === 'retry' ? 'retry_wait' : 'failed';
    await settleSuggestion(
      tx,
      tenantId,
      claimed.id,
      settlement(status, result.code, rt, { usage: result.usage }),
    );
    if (step.kind === 'retry')
      await rt.boss.send(AI_SUGGEST_QUEUE, payload, {
        startAfter: step.afterSeconds,
        db: jobDb(tx as PoolClient),
      });
    return result.code;
  });
}

async function call(
  payload: AiSuggestPayload,
  feature: AiFeature<unknown>,
  prepared: Prepared,
  ctx: { rt: AiRuntime; provider: AiProvider; progress: Progress; claimed: Claimed },
): Promise<AiOutcome> {
  let result: Awaited<ReturnType<AiProvider['complete']>> | AiProviderError;
  try {
    result = await ctx.provider.complete({
      task: prepared.task,
      input: prepared.redacted,
      outputSchema: feature.outputSchema,
    });
  } catch (error) {
    if (!(error instanceof AiProviderError)) throw error;
    result = error;
  }
  const usage = result.usage;
  Object.assign(ctx.progress, {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costMicroUsd: costMicroUsd(usage, ctx.rt.config),
  });
  const settled: SettledCall | AiProviderError =
    result instanceof AiProviderError
      ? result
      : {
          output: result.output as AiJson,
          usage: result.usage,
          ground: feature.ground
            ? async (tx) => {
                const g = await feature.ground!(
                  tx,
                  payload.tenantId,
                  result.output,
                  prepared.loaded,
                );
                ctx.progress.evidenceDropped = g.dropped;
                return g;
              }
            : undefined,
        };
  return settleCall(payload, ctx.claimed, settled, ctx.rt);
}

async function execute(
  payload: AiSuggestPayload,
  rt: AiRuntime,
  progress: Progress,
): Promise<AiOutcome> {
  const feature = rt.features[payload.feature];
  if (!feature || feature.promptVersion !== payload.promptVersion) return 'feature_off';
  const provider = rt.provider;
  if (!provider) return 'no_provider';
  const prepared = await prepare(payload, feature, rt);
  if (typeof prepared === 'string') return prepared;
  const claimed = await claim(payload, prepared, provider, rt);
  if (!('claimed' in claimed)) {
    progress.suggestionId = claimed.id ?? null;
    return claimed.outcome;
  }
  progress.suggestionId = claimed.claimed.id;
  progress.attempt = claimed.claimed.attempts;
  return call(payload, feature, prepared, { rt, provider, progress, claimed: claimed.claimed });
}

/** Parse, run every phase, and write exactly one log line for the outcome. */
export async function runSuggest(raw: unknown, rt: AiRuntime): Promise<AiOutcome> {
  const payload = aiSuggestPayloadSchema.parse(raw);
  const started = Date.now();
  const progress: Progress = {
    suggestionId: null,
    attempt: 0,
    inputTokens: 0,
    outputTokens: 0,
    costMicroUsd: 0,
    evidenceDropped: 0,
  };
  const outcome = await execute(payload, rt, progress);
  rt.log({
    tenantId: payload.tenantId,
    module: 'ai',
    job: 'ai.suggest',
    feature: payload.feature,
    promptVersion: payload.promptVersion,
    modelRef: rt.provider?.modelRef ?? 'none',
    ...progress,
    outcome,
    durationMs: Date.now() - started,
  });
  return outcome;
}
