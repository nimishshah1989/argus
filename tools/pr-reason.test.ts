import { describe, expect, it } from 'vitest';
import { largePrAllowed } from './check-pr-size.js';
import { paritySkipAllowed } from './check-parity-update.js';
import { prReason } from './pr-reason.js';

const TEMPLATE = `## Reasons

<!-- Over 800 lines, or apps/ or packages/ without the parity ledger? Add a line below, for example:
Large PR: ports the whole gallery suite
No parity: test-only change to the harness
(at least 10 characters; the examples stay inside this comment so they never count). -->
`;

describe('pr reason', () => {
  it('T1 reads the reason from a Large PR line', () => {
    expect(prReason('intro\nLarge PR: ports the whole gallery suite\n', 'Large PR')).toBe(
      'ports the whole gallery suite',
    );
  });
  it('T2 matches the key case-insensitively and after a bullet', () => {
    expect(prReason('- large pr: ports the whole gallery suite', 'Large PR')).toBe(
      'ports the whole gallery suite',
    );
  });
  it('T3 rejects a reason under 10 non-space characters', () => {
    expect(prReason('Large PR: too  big', 'Large PR')).toBeNull();
  });
  it('T4 ignores the examples inside the template comment', () => {
    expect(prReason(TEMPLATE, 'Large PR')).toBeNull();
    expect(prReason(TEMPLATE, 'No parity')).toBeNull();
  });
  it('T5 does not match the key mid-line', () => {
    expect(prReason('this is a Large PR: because I said so and more', 'Large PR')).toBeNull();
  });
  it('T6 returns null for an undefined or empty body', () => {
    expect(prReason(undefined, 'Large PR')).toBeNull();
    expect(prReason('', 'Large PR')).toBeNull();
  });
  it('T7 keeps the two keys apart', () => {
    const body = 'No parity: test-only change to the harness';
    expect(prReason(body, 'Large PR')).toBeNull();
    expect(prReason(body, 'No parity')).toBe('test-only change to the harness');
  });
  it('T7b never takes the reason from a later line', () => {
    expect(prReason('Large PR:\nsome unrelated paragraph text here', 'Large PR')).toBeNull();
    expect(prReason('Large PR:   \r\n\r\nSecond paragraph long enough', 'Large PR')).toBeNull();
    expect(prReason('Large\nPR: ports the whole suite', 'Large PR')).toBeNull();
  });
  it('T7c reads a reason from a CRLF body', () => {
    expect(prReason('intro\r\nLarge PR: ports the whole gallery suite\r\n', 'Large PR')).toBe(
      'ports the whole gallery suite',
    );
  });
  it('T8 allows a large PR by label or by body line', () => {
    const shapes = [
      { LEAN_ALLOW_LARGE: '1' },
      { PR_BODY: 'Large PR: ports the whole gallery suite' },
      {},
      { PR_BODY: 'Large PR: short' },
    ];
    expect(shapes.map((env) => largePrAllowed(env))).toEqual([true, true, false, false]);
  });
  it('T9 allows a parity skip by label or by body line', () => {
    const shapes = [
      { PARITY_ALLOW_SKIP: '1' },
      { PR_BODY: 'No parity: test-only change to the harness' },
      {},
      { PR_BODY: 'No parity: short' },
    ];
    expect(shapes.map((env) => paritySkipAllowed(env))).toEqual([true, true, false, false]);
  });
});
