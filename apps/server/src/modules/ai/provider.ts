import type { z } from 'zod';
import { createClaudeProvider } from './claude.js';
import type { AiConfig } from './config.js';
import type { AiJson } from './redact.js';

export type { AiJson } from './redact.js';

export interface AiOutputSchema<T> {
  /** Tool name, /^[a-z_]{1,64}$/. */
  name: string;
  description: string;
  /** Hand-written JSON Schema sent to the model. */
  jsonSchema: Record<string, unknown>;
  /** The reply is always validated with this (D22 §10). */
  zod: z.ZodType<T>;
  /** What the fake provider returns by default. */
  example: T;
}
export interface AiCompleteRequest<T> {
  task: string;
  input: AiJson;
  outputSchema: AiOutputSchema<T>;
}
export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}
export interface AiCompleteResult<T> {
  output: T;
  usage: AiUsage;
  modelRef: string;
}
export interface AiProvider {
  /** Stored on the row at claim, before the call. */
  readonly modelRef: string;
  complete<T>(request: AiCompleteRequest<T>): Promise<AiCompleteResult<T>>;
}

export type AiProviderErrorCode =
  'provider_error' | 'rate_limited' | 'overloaded' | 'provider_rejected' | 'schema_invalid';

export class AiProviderError extends Error {
  constructor(
    readonly code: AiProviderErrorCode,
    readonly usage: AiUsage = { inputTokens: 0, outputTokens: 0 },
    readonly retryAfterSeconds: number | null = null,
    detail = '',
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'AiProviderError';
  }
}

type FakeResult = { output: unknown; usage?: AiUsage } | AiProviderError;
export type FakeReply = FakeResult | (() => FakeResult);
export interface FakeProvider extends AiProvider {
  readonly calls: AiCompleteRequest<unknown>[];
}

const NO_USAGE: AiUsage = { inputTokens: 0, outputTokens: 0 };

export function createFakeProvider(replies: FakeReply[] = []): FakeProvider {
  const queue = [...replies];
  const calls: AiCompleteRequest<unknown>[] = [];
  return {
    modelRef: 'fake',
    calls,
    async complete<T>(request: AiCompleteRequest<T>): Promise<AiCompleteResult<T>> {
      calls.push(request as AiCompleteRequest<unknown>);
      const next = queue.shift();
      const reply = typeof next === 'function' ? next() : next;
      if (reply instanceof AiProviderError) throw reply;
      const usage = reply?.usage ?? NO_USAGE;
      if (reply === undefined)
        return { output: request.outputSchema.example, usage, modelRef: 'fake' };
      const parsed = request.outputSchema.zod.safeParse(reply.output);
      if (!parsed.success) throw new AiProviderError('schema_invalid', usage);
      return { output: parsed.data, usage, modelRef: 'fake' };
    },
  };
}

/** No key: the fake outside production, nothing in production (decision 5). */
export function pickProvider(config: AiConfig, fetchImpl?: typeof fetch): AiProvider | null {
  if (config.apiKey !== null)
    return createClaudeProvider({
      apiKey: config.apiKey,
      model: config.model,
      maxOutputTokens: config.maxOutputTokens,
      timeoutMs: config.timeoutMs,
      ...(fetchImpl ? { fetchImpl } : {}),
    });
  return config.production ? null : createFakeProvider();
}
