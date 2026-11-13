import type { z } from 'zod';
import {
  AiProviderError,
  type AiCompleteRequest,
  type AiCompleteResult,
  type AiProvider,
  type AiUsage,
} from './provider.js';

export interface ClaudeOptions {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
  /** Default globalThis.fetch; tests inject. */
  fetchImpl?: typeof fetch;
}

const URL = 'https://api.anthropic.com/v1/messages';
// Verified 13 Nov 2026 against Anthropic's Messages API docs.
const API_VERSION = '2026-10-21';

interface Reply {
  stop_reason?: unknown;
  content?: unknown;
  usage?: { input_tokens?: unknown; output_tokens?: unknown };
}

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Joins the text blocks (thinking blocks are ignored), parses them as JSON and validates. */
function answerFrom<T>(
  content: unknown,
  schema: z.ZodType<T>,
): z.SafeParseReturnType<unknown, T> | null {
  const text = Array.isArray(content)
    ? (content as { type?: unknown; text?: unknown }[])
        .filter((b) => b?.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text as string)
        .join('')
    : '';
  try {
    return schema.safeParse(JSON.parse(text));
  } catch {
    return null;
  }
}

function retryAfter(res: Response): number | null {
  const raw = res.headers.get('retry-after');
  return raw !== null && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : null;
}

function statusError(res: Response): AiProviderError {
  const detail = `HTTP ${res.status}`;
  if (res.status === 429)
    return new AiProviderError('rate_limited', undefined, retryAfter(res), detail);
  if (res.status === 529) return new AiProviderError('overloaded', undefined, null, detail);
  if (res.status >= 500) return new AiProviderError('provider_error', undefined, null, detail);
  return new AiProviderError('provider_rejected', undefined, null, detail);
}

/** One request; the answer is JSON text in the reply, constrained by a JSON Schema output format. */
export function createClaudeProvider(options: ClaudeOptions): AiProvider {
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  return {
    modelRef: options.model,
    async complete<T>(request: AiCompleteRequest<T>): Promise<AiCompleteResult<T>> {
      const schema = request.outputSchema;
      const body = {
        model: options.model,
        max_tokens: options.maxOutputTokens,
        system: request.task,
        messages: [{ role: 'user', content: JSON.stringify(request.input) }],
        output_config: { format: { type: 'json_schema', schema: schema.jsonSchema } },
      };
      let res: Response;
      try {
        res = await doFetch(URL, {
          method: 'POST',
          headers: {
            'x-api-key': options.apiKey,
            'anthropic-version': API_VERSION,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(options.timeoutMs),
        });
      } catch {
        throw new AiProviderError('provider_error', undefined, null, 'request failed');
      }
      if (res.status !== 200) throw statusError(res);
      let reply: Reply;
      try {
        reply = (await res.json()) as Reply;
      } catch {
        throw new AiProviderError('provider_error', undefined, null, 'HTTP 200 not JSON');
      }
      const usage: AiUsage = {
        inputTokens: count(reply.usage?.input_tokens),
        outputTokens: count(reply.usage?.output_tokens),
      };
      if (reply.stop_reason === 'refusal')
        throw new AiProviderError('provider_rejected', usage, null, 'refusal');
      const answer = answerFrom(reply.content, schema.zod);
      if (!answer?.success || reply.stop_reason === 'max_tokens')
        throw new AiProviderError('schema_invalid', usage);
      return { output: answer.data, usage, modelRef: options.model };
    },
  };
}
