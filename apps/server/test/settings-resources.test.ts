import { describe, expect, it } from 'vitest';
import { LADDER_RESOURCES } from '../src/modules/accountability/settings-resources.js';
import { profileResource } from '../src/modules/analytics/profile.js';
import { LIST_RESOURCES } from '../src/modules/plant/settings-lists.js';
import { RESOURCES } from '../src/modules/plant/settings-resources.js';

/**
 * Every resource a module registers with the generic settings routes. A new module adds its list here, so a
 * resource that forgets `create` cannot lose its POST without this test saying so.
 */
const REGISTERED = [...RESOURCES, ...LIST_RESOURCES, ...LADDER_RESOURCES];

describe('the settings resources', () => {
  it('gives every resource a create schema, so its screen keeps its POST', () => {
    for (const resource of REGISTERED) {
      expect(resource.create, `${resource.path} has no create schema`).toBeDefined();
    }
  });

  it('makes the analytics profile the one deliberate exception: one row, made by its first read', () => {
    expect(profileResource.path).toBe('analytics-profile');
    expect(profileResource.create).toBeUndefined();
    expect([...REGISTERED, profileResource].filter((resource) => !resource.create)).toEqual([
      profileResource,
    ]);
  });
});
