export interface AiConfig {
  production: boolean;
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
    throw new Error(`AI config: ${name} is required when ANTHROPIC_API_KEY is set`);
  return value;
}

function price(env: Env, name: string, keyed: boolean): number {
  if (!keyed && present(env[name]) === null) return 0;
  const value = Number(required(env, name));
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`AI config: ${name} is required when ANTHROPIC_API_KEY is set`);
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
  const appEnv = keyed ? required(env, 'APP_ENV') : present(env.APP_ENV);
  return {
    production: appEnv === 'production',
    apiKey,
    model: keyed ? required(env, 'AI_MODEL') : 'fake',
    priceInputUsdPerMtok: price(env, 'AI_PRICE_INPUT_USD_PER_MTOK', keyed),
    priceOutputUsdPerMtok: price(env, 'AI_PRICE_OUTPUT_USD_PER_MTOK', keyed),
    maxOutputTokens,
    defaultMonthlyCapUsd,
    timeoutMs: 30000,
  };
}
