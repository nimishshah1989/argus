import { describe, expect, it } from 'vitest';
import { publicBaseDomainFromEnv } from '../src/kernel/index.js';

describe('PUBLIC_BASE_DOMAIN', () => {
  it('is not set when absent or blank, and a plain host name is kept in lower case', () => {
    expect(publicBaseDomainFromEnv({})).toBeUndefined();
    expect(publicBaseDomainFromEnv({ PUBLIC_BASE_DOMAIN: '  ' })).toBeUndefined();
    expect(publicBaseDomainFromEnv({ PUBLIC_BASE_DOMAIN: 'Plants.Example.com' })).toBe(
      'plants.example.com',
    );
    expect(publicBaseDomainFromEnv({ PUBLIC_BASE_DOMAIN: '3-108-95-203.sslip.io' })).toBe(
      '3-108-95-203.sslip.io',
    );
  });

  it.each([
    'https://plants.example.com',
    'plants.example.com/app',
    'plants.example.com:3000',
    'a b.com',
    'x..com',
    '.x.com',
    'plants.example.com.',
    'someone@plants.example.com',
    '3.108.95.203',
    '127.0.0.1',
  ])('refuses %s, because a wrong value would print wrong QR codes', (value) => {
    expect(() => publicBaseDomainFromEnv({ PUBLIC_BASE_DOMAIN: value })).toThrow(/bare host name/);
  });
});
