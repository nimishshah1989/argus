import { describe, expect, it } from 'vitest';
import type { AiConfig } from '../src/modules/ai/config.js';
import {
  costMicroUsd,
  maxCallCostMicroUsd,
  monthStartUtc,
  retryPlan,
} from '../src/modules/ai/limits.js';

const config = (input: number, output: number, maxOutputTokens = 1024): AiConfig => ({
  production: false,
  apiKey: null,
  model: 'fake',
  priceInputUsdPerMtok: input,
  priceOutputUsdPerMtok: output,
  maxOutputTokens,
  defaultMonthlyCapUsd: 50,
  timeoutMs: 30_000,
});

describe('ai limits', () => {
  it('retries provider errors twice: 30 s then 2 min', () => {
    expect(retryPlan('provider_error', 1, null)).toEqual({ kind: 'retry', afterSeconds: 30 });
    expect(retryPlan('provider_error', 2, null)).toEqual({ kind: 'retry', afterSeconds: 120 });
    expect(retryPlan('provider_error', 3, null)).toEqual({ kind: 'fail' });
  });

  it('retries rate limits and overloads up to four calls, honouring retry-after up to 10 min', () => {
    for (const code of ['rate_limited', 'overloaded'] as const) {
      expect(retryPlan(code, 1, null)).toEqual({ kind: 'retry', afterSeconds: 60 });
      expect(retryPlan(code, 2, null)).toEqual({ kind: 'retry', afterSeconds: 120 });
      expect(retryPlan(code, 3, null)).toEqual({ kind: 'retry', afterSeconds: 240 });
      expect(retryPlan(code, 4, null)).toEqual({ kind: 'fail' });
      expect(retryPlan(code, 1, 20)).toEqual({ kind: 'retry', afterSeconds: 20 });
      expect(retryPlan(code, 1, 3600)).toEqual({ kind: 'retry', afterSeconds: 600 });
    }
  });

  it('retries an invalid reply once and never retries a rejection or a redaction failure', () => {
    expect(retryPlan('schema_invalid', 1, null)).toEqual({ kind: 'retry', afterSeconds: 30 });
    expect(retryPlan('schema_invalid', 2, null)).toEqual({ kind: 'fail' });
    expect(retryPlan('schema_invalid', 3, null)).toEqual({ kind: 'fail' });
    expect(retryPlan('provider_rejected', 1, null)).toEqual({ kind: 'fail' });
    expect(retryPlan('redaction_failed', 0, null)).toEqual({ kind: 'fail' });
  });

  it('computes cost, the largest possible cost and the UTC month start', () => {
    expect(costMicroUsd({ inputTokens: 1000, outputTokens: 200 }, config(3, 15))).toBe(6000);
    expect(costMicroUsd({ inputTokens: 1001, outputTokens: 0 }, config(0.5, 0.5))).toBe(501);
    expect(maxCallCostMicroUsd(2000, config(3, 15))).toBe(21_360);
    expect(monthStartUtc(new Date('2026-11-30T23:30:00-05:00'))).toEqual(
      new Date('2026-12-01T00:00:00Z'),
    );
  });
});
