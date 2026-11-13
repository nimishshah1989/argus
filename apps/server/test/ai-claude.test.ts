import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AiProviderError, type AiOutputSchema } from '../src/modules/ai/index.js';
import { createClaudeProvider } from '../src/modules/ai/claude.js';

const KEY = 'fake-key-for-tests';
const TASK = 'Secret task wording.';
const BODY_TEXT = 'response-body-marker-text';

const outputSchema: AiOutputSchema<{ answer: string }> = {
  name: 'record_answer',
  description: 'Record the answer.',
  jsonSchema: {
    type: 'object',
    properties: { answer: { type: 'string' } },
    required: ['answer'],
  },
  zod: z.object({ answer: z.string() }),
  example: { answer: 'example' },
};

type Recorded = { url: string; init: RequestInit };
function recorder(respond: () => Response) {
  const calls: Recorded[] = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(respond());
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}
const provider = (fetchImpl: typeof fetch, timeoutMs = 30000) =>
  createClaudeProvider({
    apiKey: KEY,
    model: 'test-model-id',
    maxOutputTokens: 1024,
    timeoutMs,
    fetchImpl,
  });
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const toolReply = (input: unknown, extra: Record<string, unknown> = {}) =>
  json({
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', id: 'toolu_1', name: 'record_answer', input }],
    usage: { input_tokens: 50, output_tokens: 10 },
    ...extra,
  });
const ask = (p: ReturnType<typeof provider>) =>
  p.complete({ task: TASK, input: { problem: 'p' }, outputSchema });
const caught = async (p: ReturnType<typeof provider>): Promise<AiProviderError> => {
  try {
    await ask(p);
  } catch (error) {
    return error as AiProviderError;
  }
  throw new Error('expected a throw');
};
const failWith = (res: () => Response) => caught(provider(recorder(res).fetchImpl));

describe('claude provider', () => {
  it('sends one request with the key, version, model, task, input and one forced output tool', async () => {
    const { calls, fetchImpl } = recorder(() =>
      json({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 't', name: 'record_answer', input: { answer: 'x' } }],
        usage: { input_tokens: 120, output_tokens: 30 },
      }),
    );
    const result = await provider(fetchImpl).complete({
      task: 'T',
      input: { problem: 'p' },
      outputSchema,
    });
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe(KEY);
    expect(headers['anthropic-version']).toBeTruthy();
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: 'test-model-id',
      max_tokens: 1024,
      system: 'T',
      messages: [{ role: 'user', content: JSON.stringify({ problem: 'p' }) }],
      tool_choice: { type: 'tool', name: 'record_answer' },
    });
    expect(body.tools).toEqual([
      {
        name: 'record_answer',
        description: 'Record the answer.',
        input_schema: outputSchema.jsonSchema,
      },
    ]);
    expect(JSON.stringify(body)).not.toContain('"image"');
    expect(result).toEqual({
      output: { answer: 'x' },
      usage: { inputTokens: 120, outputTokens: 30 },
      modelRef: 'test-model-id',
    });
  });

  it('maps 429 with retry-after, 529 and 5xx', async () => {
    const cases: [() => Response, string, number | null][] = [
      [() => json({}, 429, { 'retry-after': '20' }), 'rate_limited', 20],
      [() => json({}, 429), 'rate_limited', null],
      [() => json({}, 529), 'overloaded', null],
      [() => json({}, 500), 'provider_error', null],
      [() => json({}, 503), 'provider_error', null],
    ];
    for (const [res, code, retry] of cases) {
      const error = await failWith(res);
      expect(error).toBeInstanceOf(AiProviderError);
      expect(error.code).toBe(code);
      expect(error.retryAfterSeconds).toBe(retry);
    }
  });

  it('maps 400, 401, 403 and 404 to provider_rejected', async () => {
    for (const status of [400, 401, 403, 404])
      expect((await failWith(() => json({}, status))).code).toBe('provider_rejected');
  });

  it('maps a network failure and a timeout to provider_error', async () => {
    const network = (() =>
      Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;
    expect((await caught(provider(network))).code).toBe('provider_error');
    const hangs = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })) as unknown as typeof fetch;
    const started = Date.now();
    expect((await caught(provider(hangs, 50))).code).toBe('provider_error');
    expect(Date.now() - started).toBeLessThan(1000);
  });

  const invalid: (() => Response)[] = [
    () => toolReply({ answer: 'x' }, { stop_reason: 'max_tokens' }),
    () => toolReply({ answer: 'x' }, { stop_reason: 'refusal' }),
    () =>
      json({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: BODY_TEXT }],
        usage: { input_tokens: 50, output_tokens: 10 },
      }),
    () => toolReply({ answer: 3 }),
  ];

  it('maps a cut-short, refused or invalid reply to schema_invalid and keeps its usage', async () => {
    for (const make of invalid) {
      const error = await failWith(make);
      expect(error.code).toBe('schema_invalid');
      expect(error.usage).toEqual({ inputTokens: 50, outputTokens: 10 });
    }
  });

  it('maps a 200 reply that is not JSON to provider_error', async () => {
    expect((await failWith(() => new Response('<html>nope</html>'))).code).toBe('provider_error');
  });

  it('never puts the key, the request or the response body in an error', async () => {
    const failing: (() => Response)[] = [
      () => json({ error: BODY_TEXT }, 429, { 'retry-after': '20' }),
      () => json({ error: BODY_TEXT }, 529),
      () => json({ error: BODY_TEXT }, 500),
      () => json({ error: BODY_TEXT }, 400),
      () => new Response(BODY_TEXT),
      ...invalid,
    ];
    const network = (() =>
      Promise.reject(new TypeError(`fetch failed ${KEY}`))) as unknown as typeof fetch;
    const errors = [await caught(provider(network))];
    for (const make of failing) errors.push(await failWith(make));
    for (const error of errors)
      for (const text of [error.message, String(error), JSON.stringify(error)])
        for (const banned of [KEY, TASK, BODY_TEXT]) expect(text).not.toContain(banned);
  });
});
