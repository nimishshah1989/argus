import { describe, expect, it } from 'vitest';
import { load } from './data.js';
import { dashboardFixture } from './dashboard/fixture.js';

describe('the v2 screen data seam', () => {
  it('is ready with the model a provider returns', async () => {
    expect(await load<'dashboard'>(() => Promise.resolve(dashboardFixture), {})).toEqual({
      state: 'ready',
      model: dashboardFixture,
    });
  });

  it('is empty when the provider has nothing to show', async () => {
    expect(await load<'dashboard'>(() => Promise.resolve(null), {})).toEqual({ state: 'empty' });
  });

  it('is an error, not a crash, when the provider fails', async () => {
    expect(await load<'dashboard'>(() => Promise.reject(new Error('down')), {})).toEqual({
      state: 'error',
    });
  });
});
