import type { FastifyInstance } from 'fastify';
import { apiError, errorBodySchema } from '@uptimo/shared';
import { REPLY_SCHEMAS } from '@uptimo/shared/replies';

/** Why a JSON reply breaks the contract (route, status, failing paths), or null. */
export function replyProblem(route: string, status: number, body: unknown): string | null {
  if (!(route in REPLY_SCHEMAS)) return `${route} has no reply schema`;
  if (status >= 400 && errorBodySchema.safeParse(body).success) return null;
  const schema = REPLY_SCHEMAS[route];
  if (!schema) return `${route} is binary but sent JSON`;
  const result = schema.safeParse(body);
  if (result.success) return null;
  const issues = result.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ');
  return `${route} ${status}: ${issues}`;
}

/** onSend: checks JSON replies of matched routes; a problem becomes 500 + an `internal` error. */
export function registerReplyCheck(app: FastifyInstance): void {
  app.addHook('onSend', async (request, reply, payload) => {
    const type = String(reply.getHeader('content-type') ?? '');
    const url = request.routeOptions.url;
    if (request.method === 'HEAD' || request.is404 || !url || typeof payload !== 'string') {
      return payload;
    }
    if (!type.startsWith('application/json')) return payload;
    const problem = replyProblem(`${request.method} ${url}`, reply.statusCode, JSON.parse(payload));
    if (problem === null) return payload;
    reply.code(500).header('content-type', 'application/json; charset=utf-8');
    return JSON.stringify(apiError('internal', `Reply contract: ${problem}`));
  });
}
