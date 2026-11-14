import type { FastifyReply } from 'fastify';
import { apiError } from '@uptimo/shared';
import type { ActorContext } from '@uptimo/domain';

/** The signed-in login as the domain's permission checks want it. */
export function actorOf(ctx: {
  role: string;
  loginId: string;
  personId: string | null;
  shared: boolean;
}): ActorContext {
  return {
    role: ctx.role as ActorContext['role'],
    loginId: ctx.loginId,
    personId: ctx.personId,
    shared: ctx.shared,
  };
}

export function forbidden(reply: FastifyReply): void {
  reply.code(403).send(apiError('forbidden', 'You do not have permission for this action'));
}
