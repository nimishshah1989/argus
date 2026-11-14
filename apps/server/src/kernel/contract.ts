import type { FastifyReply } from 'fastify';
import { apiError, isUuid, type ErrorCode } from '@uptimo/shared';

/** A refusal ready to send: the status and the standard error body. */
export interface Refusal {
  status: number;
  body: unknown;
}

export const refuse = (
  status: number,
  code: ErrorCode,
  message: string,
  field?: string,
): Refusal => ({
  status,
  body: apiError(code, message, field),
});

/** A zod failure as a 422 that names the field; a key the form may not send names that key. */
export function fieldProblem(error: {
  issues: { code: string; path: PropertyKey[]; message: string; keys?: string[] }[];
}): Refusal {
  const issue = error.issues[0]!;
  if (issue.code === 'unrecognized_keys' && issue.keys?.[0]) {
    return refuse(422, 'validation', `${issue.keys[0]} cannot be set here`, issue.keys[0]);
  }
  return refuse(422, 'validation', issue.message, issue.path.map(String).join('.') || undefined);
}

/**
 * The id in the path comes before the body: an id that is not a uuid names no row, so the answer is 404
 * whatever the body says. Sends the 404 and returns false when the id is bad.
 */
export function idOrNotFound(reply: FastifyReply, id: string, what: string): boolean {
  if (isUuid(id)) return true;
  reply.code(404).send(apiError('not_found', `Unknown ${what}`, 'id'));
  return false;
}
