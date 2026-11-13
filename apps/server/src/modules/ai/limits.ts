import type { AiConfig } from './config.js';
import type { AiProviderErrorCode, AiUsage } from './provider.js';

export type RetryStep = { kind: 'retry'; afterSeconds: number } | { kind: 'fail' };

const FAIL: RetryStep = { kind: 'fail' };
const PROVIDER_ERROR_WAITS = [30, 120];
const BACKOFF_WAITS = [60, 120, 240];
const MAX_RETRY_AFTER_SECONDS = 600;

/**
 * `attempts` is the row's total provider calls, this one included. The limit counts all attempts
 * on the row, whatever earlier ones returned, so no row ever exceeds four calls.
 */
export function retryPlan(
  code: AiProviderErrorCode | 'redaction_failed',
  attempts: number,
  retryAfterSeconds: number | null,
): RetryStep {
  switch (code) {
    case 'provider_error': {
      const wait = PROVIDER_ERROR_WAITS[attempts - 1];
      return attempts < 3 && wait !== undefined ? { kind: 'retry', afterSeconds: wait } : FAIL;
    }
    case 'rate_limited':
    case 'overloaded': {
      const wait =
        retryAfterSeconds !== null
          ? Math.min(retryAfterSeconds, MAX_RETRY_AFTER_SECONDS)
          : BACKOFF_WAITS[attempts - 1];
      return attempts < 4 && wait !== undefined ? { kind: 'retry', afterSeconds: wait } : FAIL;
    }
    case 'schema_invalid':
      return attempts < 2 ? { kind: 'retry', afterSeconds: 30 } : FAIL;
    default:
      return FAIL;
  }
}

/** 1 USD per million tokens is 1 micro-USD per token. */
export function costMicroUsd(usage: AiUsage, config: AiConfig): number {
  return Math.ceil(
    usage.inputTokens * config.priceInputUsdPerMtok +
      usage.outputTokens * config.priceOutputUsdPerMtok,
  );
}

/** A token is at least one byte, so the byte length bounds the input tokens from above. */
export function maxCallCostMicroUsd(promptBytes: number, config: AiConfig): number {
  return Math.ceil(
    promptBytes * config.priceInputUsdPerMtok +
      config.maxOutputTokens * config.priceOutputUsdPerMtok,
  );
}

export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
