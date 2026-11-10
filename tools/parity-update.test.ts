import { describe, expect, it } from 'vitest';
import { parityUpdateErrors } from './check-parity-update.js';

describe('parity update guard', () => {
  it('passes a docs-only change', () => {
    expect(parityUpdateErrors(['docs/plan/STATUS.md', 'README.md'])).toEqual([]);
  });

  it('passes a product change that updates the ledger', () => {
    expect(parityUpdateErrors(['apps/web/src/App.tsx', 'docs/spec/parity.yaml'])).toEqual([]);
  });

  it('fails a product change with no ledger update', () => {
    const errors = parityUpdateErrors(['apps/server/src/tickets.ts']);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('docs/spec/parity.yaml');
  });

  it('ignores a package lock or test-only docs change', () => {
    expect(parityUpdateErrors(['pnpm-lock.yaml', 'docs/spec/PARITY.md'])).toEqual([]);
  });
});
