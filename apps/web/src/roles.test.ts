import { describe, expect, it } from 'vitest';
import { landingPath, mayOpenDesk } from './roles.js';

/** Packet 1: where a sign-in lands, by the role in the session reply (all seven roles). */
describe('landingPath', () => {
  it('sends the technician and above to the desk', () => {
    for (const role of ['technician', 'supervisor', 'head', 'plant_head', 'admin'])
      expect(landingPath(role)).toBe('/desk');
  });

  it('sends the operator and the board to the floor', () => {
    for (const role of ['operator', 'board']) expect(landingPath(role)).toBe('/floor');
  });

  it('agrees with mayOpenDesk for every role', () => {
    for (const role of [
      'operator',
      'technician',
      'supervisor',
      'head',
      'plant_head',
      'admin',
      'board',
    ])
      expect(mayOpenDesk(role)).toBe(landingPath(role) === '/desk');
  });
});
