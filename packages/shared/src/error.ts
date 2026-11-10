export type ErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'not_configured'
  | 'internal';

export interface ErrorBody {
  error: { code: ErrorCode; message: string; field?: string };
}

export function apiError(code: ErrorCode, message: string, field?: string): ErrorBody {
  const error: ErrorBody['error'] = { code, message };
  if (field) error.field = field;
  return { error };
}
