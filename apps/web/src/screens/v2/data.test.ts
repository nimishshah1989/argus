import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FROZEN, PROVIDERS, frozenOf, load, providersOf } from './data.js';
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

describe('the v2 screen registry', () => {
  const folders = readdirSync(new URL('.', import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  it('serves a screen from its own folder, with no shared file to edit', async () => {
    const found = providersOf({
      './demo/register.ts': { screen: { key: 'demo', provider: () => Promise.resolve('model') } },
    });
    expect(Object.keys(found)).toEqual(['demo']);
    expect(await (found.demo as () => Promise<string>)()).toBe('model');
  });

  it("keeps a screen's frozen answer apart from its live provider, and only for the screens that have one", () => {
    const live = () => Promise.resolve('live');
    const frozen = () => Promise.resolve('frozen');
    const modules = {
      './a/register.ts': { screen: { key: 'a', provider: live, frozen } },
      './b/register.ts': { screen: { key: 'b', provider: live } },
    };
    expect(providersOf(modules)).toEqual({ a: live, b: live });
    expect(frozenOf(modules)).toEqual({ a: frozen });
  });

  it('keeps a frozen answer for the gallery on each screen that now reads the server', () => {
    for (const key of ['breakdown-log', 'fix-finder', 'problem-analysis'])
      expect(FROZEN, key).toHaveProperty(key);
  });

  it('refuses two screens that claim one key', () => {
    const screen = { key: 'demo', provider: () => Promise.resolve(null) };
    expect(() =>
      providersOf({ './a/register.ts': { screen }, './b/register.ts': { screen } }),
    ).toThrow(/demo is taken/);
  });

  it('finds every screen folder that has a register.ts, under the folder name', () => {
    const registered = folders.filter((name) =>
      existsSync(new URL(`./${name}/register.ts`, import.meta.url)),
    );
    expect(registered.length).toBeGreaterThanOrEqual(7);
    expect(Object.keys(PROVIDERS).sort()).toEqual([...registered].sort());
  });

  it('has no screen folder with a fixture and no register.ts', () => {
    const unregistered = folders.filter(
      (name) =>
        existsSync(new URL(`./${name}/fixture.ts`, import.meta.url)) &&
        !existsSync(new URL(`./${name}/register.ts`, import.meta.url)),
    );
    expect(unregistered).toEqual([]);
  });

  it('serves the fixture of a registered screen', async () => {
    const provider = PROVIDERS.dashboard as () => Promise<unknown>;
    expect(await provider()).toBe(dashboardFixture);
  });
});
