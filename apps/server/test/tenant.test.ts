import { describe, expect, it } from 'vitest';
import { tenantSlugFromHost } from '../src/tenant.js';

describe('tenantSlugFromHost', () => {
  it('returns the subdomain for a dotted host', () => {
    expect(tenantSlugFromHost('cosmos.uptimo.in')).toBe('cosmos');
    expect(tenantSlugFromHost('cosmos.staging.uptimo.in')).toBe('cosmos');
  });

  it('resolves a bare IP to the default tenant', () => {
    expect(tenantSlugFromHost('13.126.1.2')).toBe('cosmos');
    expect(tenantSlugFromHost('13.126.1.2:443')).toBe('cosmos');
  });

  it('returns null for a bare hostname with no subdomain', () => {
    expect(tenantSlugFromHost('localhost')).toBeNull();
  });
});
