import { describe, expect, it } from 'vitest';
import { ApiError, describeFailure, worthRetrying } from './client.js';

describe('what a failed load does next', () => {
  it('retries a lost connection and a server fault, never a refusal', () => {
    expect(worthRetrying(new TypeError('Failed to fetch'))).toBe(true);
    expect(worthRetrying(new ApiError('internal', 'Request failed: 502', undefined, 502))).toBe(
      true,
    );
    for (const code of ['unauthenticated', 'forbidden', 'not_found', 'validation', 'conflict'])
      expect(worthRetrying(new ApiError(code, 'no'))).toBe(false);
  });

  it('describes a failure in one line, with the status and code when there is one', () => {
    expect(describeFailure(new TypeError('Failed to fetch'))).toBe('TypeError: Failed to fetch');
    expect(describeFailure(new ApiError('internal', 'Request failed: 502', undefined, 502))).toBe(
      'ApiError internal 502 Request failed: 502',
    );
    expect(describeFailure('odd')).toBe('odd');
  });
});
