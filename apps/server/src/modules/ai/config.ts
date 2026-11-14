export interface AiConfig {
  production: boolean;
  /** Reference to the filed residency record (ADR 0007, completed from the signed terms). Null: not filed. */
  residencyRecord: string | null;
  apiKey: string | null;
  model: string;
  priceInputUsdPerMtok: number;
  priceOutputUsdPerMtok: number;
  maxOutputTokens: number;
  defaultMonthlyCapUsd: number;
  timeoutMs: number;
}

type Env = Record<string, string | undefined>;

const present = (value: string | undefined): string | null =>
  value !== undefined && value.trim() !== '' ? value.trim() : null;

function required(env: Env, name: string): string {
  const value = present(env[name]);
  if (value === null)
    throw new Error(`AI config: ${name} is required for a model not in the price table`);
  return value;
}

/** Anthropic list prices, USD per million tokens (input, output). Update when Anthropic changes them. */
const PRICES: Record<string, [number, number]> = {
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20],
};
const DEFAULT_MODEL = 'claude-sonnet-5-5';

function price(env: Env, name: string, listed: number | undefined, keyed: boolean): number {
  if (!keyed && present(env[name]) === null) return 0;
  if (listed !== undefined && present(env[name]) === null) return listed;
  const value = Number(required(env, name));
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`AI config: ${name} is required for a model not in the price table`);
  return value;
}

/** Reads the AI settings once at start. Messages name a variable, never a value. */
export function aiConfigFromEnv(env: Env): AiConfig {
  const apiKey = present(env.ANTHROPIC_API_KEY);
  const keyed = apiKey !== null;
  const maxOutputTokens = Number(present(env.AI_MAX_OUTPUT_TOKENS) ?? 1024);
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 8192)
    throw new Error('AI config: AI_MAX_OUTPUT_TOKENS must be an integer from 1 to 8192');
  const defaultMonthlyCapUsd = Number(present(env.AI_DEFAULT_MONTHLY_CAP_USD) ?? 50);
  if (!Number.isFinite(defaultMonthlyCapUsd) || defaultMonthlyCapUsd <= 0)
    throw new Error('AI config: AI_DEFAULT_MONTHLY_CAP_USD must be a positive number');
  const model = keyed ? (present(env.AI_MODEL) ?? DEFAULT_MODEL) : 'fake';
  const listed = PRICES[model];
  return {
    production: present(env.APP_ENV) === 'production',
    residencyRecord: present(env.AI_RESIDENCY_RECORD),
    apiKey,
    model,
    priceInputUsdPerMtok: price(env, 'AI_PRICE_INPUT_USD_PER_MTOK', listed?.[0], keyed),
    priceOutputUsdPerMtok: price(env, 'AI_PRICE_OUTPUT_USD_PER_MTOK', listed?.[1], keyed),
    maxOutputTokens,
    defaultMonthlyCapUsd,
    timeoutMs: 30000,
  };
}
