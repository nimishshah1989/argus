import { z } from 'zod';

export const errorCodeSchema = z.enum([
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'validation',
  'rate_limited',
  'not_configured',
  'internal',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorBodySchema = z
  .object({
    error: z
      .object({ code: errorCodeSchema, message: z.string(), field: z.string().optional() })
      .strict(),
  })
  .strict();
export type ErrorBody = z.infer<typeof errorBodySchema>;

export function apiError(code: ErrorCode, message: string, field?: string): ErrorBody {
  const error: ErrorBody['error'] = { code, message };
  if (field) error.field = field;
  return { error };
}
