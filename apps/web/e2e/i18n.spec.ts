import { expect, test } from './test.js';
import { apiLogin } from './fixtures.js';
import { getJson } from './fixtures-actions.js';

/** The tenant language comes from the seed; the `gujarati` project seeds `gu`. */
test('serves the project language', async ({ uiLanguage }) => {
  const config = await getJson<{ language: string }>(await apiLogin('asha'), '/api/v1/config');
  expect(config.language).toBe(uiLanguage);
});
