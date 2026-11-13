import type { FastifyReply, FastifyRequest, FastifyServerOptions } from 'fastify';

export type LoggerOptions = Exclude<FastifyServerOptions['logger'], boolean | undefined>;

const PERSONAL = ['name', 'phone', 'username', 'password', 'token', 'endpoint', 'text', 'problem'];

/** JSON logs with no client address, no bodies and no personal fields (names, phones, credentials). */
export function loggerOptions(stream?: { write(line: string): void }): LoggerOptions {
  return {
    level: 'info',
    ...(stream ? { stream } : {}),
    base: { pid: process.pid },
    redact: {
      paths: [
        'body',
        '*.body',
        'req.headers.authorization',
        'req.headers.cookie',
        ...PERSONAL.flatMap((key) => [key, `*.${key}`]),
      ],
      censor: '[redacted]',
    },
    serializers: {
      req: (req: { method: string; url: string }) => ({
        method: req.method,
        url: req.url.split('?')[0],
      }),
    },
  };
}

/** Adds fields to every later line of this request. The reply keeps its own logger reference. */
export function bindLog(
  request: FastifyRequest,
  reply: FastifyReply,
  fields: Record<string, string>,
): void {
  request.log = request.log.child(fields);
  reply.log = request.log;
}
