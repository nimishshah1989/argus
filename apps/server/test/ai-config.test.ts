import { describe, expect, it } from 'vitest';
import { aiConfigFromEnv, pickProvider } from '../src/modules/ai/index.js';

const KEY = 'fake-key-for-tests';
const FULL = {
  ANTHROPIC_API_KEY: KEY,
  APP_ENV: 'production',
  AI_MODEL: 'test-model-id',
  AI_PRICE_INPUT_USD_PER_MTOK: '3',
  AI_PRICE_OUTPUT_USD_PER_MTOK: '15',
};

describe('ai configuration', () => {
  it('has no provider in production when no key is set', () => {
    expect(pickProvider(aiConfigFromEnv({ APP_ENV: 'production' }))).toBeNull();
  });

  it('uses the fake provider when no key is set', () => {
    const config = aiConfigFromEnv({ APP_ENV: 'staging' });
    expect(config).toMatchObject({
      apiKey: null,
      model: 'fake',
      priceInputUsdPerMtok: 0,
      priceOutputUsdPerMtok: 0,
      maxOutputTokens: 1024,
      defaultMonthlyCapUsd: 50,
      production: false,
    });
    expect(pickProvider(config)?.modelRef).toBe('fake');
  });

  it('runs on the key alone: Sonnet 5.5, its listed prices, not production', () => {
    const config = aiConfigFromEnv({ ANTHROPIC_API_KEY: KEY });
    expect(config).toMatchObject({
      apiKey: KEY,
      model: 'claude-sonnet-5-5',
      priceInputUsdPerMtok: 2,
      priceOutputUsdPerMtok: 10,
      production: false,
    });
    expect(pickProvider(config)?.modelRef).toBe('claude-sonnet-5-5');
    const opus = aiConfigFromEnv({ ANTHROPIC_API_KEY: KEY, AI_MODEL: 'claude-opus-5-5' });
    expect([opus.priceInputUsdPerMtok, opus.priceOutputUsdPerMtok]).toEqual([4, 20]);
  });

  it('needs prices for a model not in the table, without printing the key', () => {
    const env = { ANTHROPIC_API_KEY: KEY, AI_MODEL: 'test-model-id' };
    expect(() => aiConfigFromEnv(env)).toThrow('AI_PRICE_INPUT_USD_PER_MTOK');
    expect(() => aiConfigFromEnv(env)).not.toThrow(new RegExp(KEY));
    const bad = { ...FULL, AI_PRICE_INPUT_USD_PER_MTOK: 'abc' };
    expect(() => aiConfigFromEnv(bad)).toThrow('AI_PRICE_INPUT_USD_PER_MTOK');
    expect(() => aiConfigFromEnv(bad)).not.toThrow(new RegExp(KEY));
    for (const value of ['0', '9000', '1.5'])
      expect(() => aiConfigFromEnv({ AI_MAX_OUTPUT_TOKENS: value })).toThrow(
        'AI config: AI_MAX_OUTPUT_TOKENS must be an integer from 1 to 8192',
      );
    for (const value of ['0', 'x'])
      expect(() => aiConfigFromEnv({ AI_DEFAULT_MONTHLY_CAP_USD: value })).toThrow(
        'AI config: AI_DEFAULT_MONTHLY_CAP_USD must be a positive number',
      );
  });

  it('builds the Claude provider from a full configuration', () => {
    const config = aiConfigFromEnv(FULL);
    expect(config.production).toBe(true);
    expect(config.priceInputUsdPerMtok).toBe(3);
    expect(config.priceOutputUsdPerMtok).toBe(15);
    expect(pickProvider(config)?.modelRef).toBe('test-model-id');
  });
});
