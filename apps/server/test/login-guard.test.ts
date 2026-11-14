import { describe, expect, it } from 'vitest';
import { createLoginGuard } from '../src/modules/identity/login-guard.js';

const T = 'tenant-1';
const burn = (guard: ReturnType<typeof createLoginGuard>, name: string, times: number) => {
  for (let i = 0; i < times; i++) guard.take('203.0.113.9', T, name);
};

describe('login guard', () => {
  it('allows 20 attempts per sender and name, then asks to wait', () => {
    const guard = createLoginGuard();
    for (let i = 0; i < 20; i++) expect(guard.take('203.0.113.9', T, 'asha')).toBe(0);
    expect(guard.take('203.0.113.9', T, 'asha')).toBeGreaterThan(0);
    expect(guard.take('203.0.113.9', T, 'someone-else')).toBe(0);
    expect(guard.take('203.0.113.10', T, 'asha')).toBe(0);
  });

  it('never lets one sender trying many names refuse a different name', () => {
    const guard = createLoginGuard();
    for (let i = 0; i < 500; i++) guard.take('203.0.113.9', T, `spray-${i}`);
    expect(guard.take('203.0.113.9', T, 'asha')).toBe(0);
  });

  it('gives an attempt back on a correct password', () => {
    const guard = createLoginGuard();
    for (let i = 0; i < 100; i++) {
      expect(guard.take('203.0.113.9', T, 'cell-phone')).toBe(0);
      guard.refund('203.0.113.9', T, 'cell-phone');
    }
  });

  it('keeps a locked name locked while many other names churn through a full table', () => {
    const guard = createLoginGuard(Date.now, 4);
    burn(guard, 'locked', 20);
    expect(guard.take('203.0.113.9', T, 'locked')).toBeGreaterThan(0);
    for (let i = 0; i < 50; i++) expect(guard.take('203.0.113.9', T, `other-${i}`)).toBe(0);
    expect(guard.take('203.0.113.9', T, 'locked')).toBeGreaterThan(0);
  });

  it('answers 429 for a new name, rather than evicting, when every tracked name is locked', () => {
    const guard = createLoginGuard(Date.now, 3);
    for (const name of ['a', 'b', 'c']) burn(guard, name, 20);
    expect(guard.take('203.0.113.9', T, 'new-name')).toBeGreaterThan(0);
    for (const name of ['a', 'b', 'c']) {
      expect(guard.take('203.0.113.9', T, name), name).toBeGreaterThan(0);
    }
  });

  it('forgets a locked name when its window has passed', () => {
    let now = 1_000_000;
    const guard = createLoginGuard(() => now, 3);
    burn(guard, 'a', 20);
    expect(guard.take('203.0.113.9', T, 'a')).toBeGreaterThan(0);
    now += 6 * 60 * 1000;
    expect(guard.take('203.0.113.9', T, 'a')).toBe(0);
  });
});
