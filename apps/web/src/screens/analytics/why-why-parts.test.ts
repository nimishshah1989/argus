import { describe, expect, it } from 'vitest';
import { mayWrite, shownName, type Viewer } from './why-why-parts.js';

/** R3's guard on the A6 screen: the same analytics roles the Why-Why routes accept, and no one else. */
const viewer = (role: string): Viewer => ({
  role,
  id: 'login-1',
  name: 'Hari',
  actingPersonId: 'person-1',
  shared: false,
});

describe('who may save a Why-Why', () => {
  it('lets the four analytics roles write', () => {
    for (const role of ['supervisor', 'head', 'plant_head', 'admin'])
      expect(mayWrite(viewer(role)), role).toBe(true);
  });

  it('refuses the floor roles and a login with no known role', () => {
    for (const role of ['technician', 'operator', 'board'])
      expect(mayWrite(viewer(role)), role).toBe(false);
    expect(mayWrite(undefined)).toBe(false);
  });
});

describe('the author the form prints', () => {
  it('shows the acting person before the login name', () => {
    expect(shownName({ ...viewer('head'), actingPerson: { name: 'Bina' } })).toBe('Bina');
    expect(shownName(viewer('head'))).toBe('Hari');
    expect(shownName(undefined)).toBe('');
  });
});
