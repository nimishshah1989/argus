import { expect, test } from './test.js';
import { API_URL, E2E_PASSWORD, TENANT, apiLogin } from './fixtures.js';

test("signs in to this worker's own tenant and nowhere else", async () => {
  expect(TENANT.slug).toBe(`e2e-w${test.info().workerIndex}`);
  expect(await apiLogin('asha')).not.toBe('');
  const unscoped = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'asha', password: E2E_PASSWORD }),
  });
  expect(unscoped.status).toBe(404);
});
