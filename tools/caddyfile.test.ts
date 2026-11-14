import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Caddy orders `handle` before `reverse_proxy`: a bare `reverse_proxy /api/*` next to a catch-all `handle`
// is never reached, and every API call gets the web app's index.html (seen on staging, 14 Nov 2026).
describe('the Caddyfile', () => {
  const caddy = readFileSync(new URL('../infra/Caddyfile', import.meta.url), 'utf8');

  it('sends /api to the server from its own handle block', () => {
    expect(caddy).toMatch(/handle \/api\/\* \{\s*reverse_proxy server:3001\s*\}/);
  });

  it('has no reverse_proxy outside a handle block', () => {
    const bare = caddy.split('\n').filter((line) => /^\s{2}reverse_proxy/.test(line));
    expect(bare).toEqual([]);
  });
});
