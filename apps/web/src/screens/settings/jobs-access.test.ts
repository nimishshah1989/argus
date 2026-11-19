import { describe, expect, it } from 'vitest';
import type { User } from '@uptimo/shared/auth';
import { canSeeJobs } from './jobs-access.js';

const user = (role: string, over: Partial<User> = {}): User => ({
  id: 'login-1',
  username: role,
  name: role,
  title: null,
  role,
  shared: false,
  actingPersonId: 'person-1',
  ...over,
});

/** The Settings entry, the count and the direct URL all ask this one question. */
describe('canSeeJobs', () => {
  it('lists background jobs for the admin and the head on a personal login', () => {
    for (const role of ['admin', 'head']) expect(canSeeJobs(user(role)), role).toBe(true);
  });

  it('hides them from every other role', () => {
    for (const role of ['operator', 'technician', 'supervisor', 'plant_head', 'board'])
      expect(canSeeJobs(user(role)), role).toBe(false);
  });

  it('hides them on a shared phone, from our own support staff, and before the person is known', () => {
    expect(canSeeJobs(user('admin', { shared: true }))).toBe(false);
    expect(canSeeJobs(user('head', { supportGrantId: 'grant-1' }))).toBe(false);
    expect(canSeeJobs(undefined)).toBe(false);
  });
});
