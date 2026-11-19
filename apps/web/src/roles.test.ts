import { describe, expect, it } from 'vitest';
import { landingPath, mayOpenDesk, readsAnalytics } from './roles.js';

/**
 * Row 38: each role's home opens on what needs that person now (MILESTONES row 38). The operator opens
 * My complaints, the technician Mine, the supervisor and admin the Open desk, and the maintenance head
 * and plant head the analytics Today dashboard.
 */
describe('landingPath', () => {
  it('sends the head and the plant head to Today', () => {
    for (const role of ['head', 'plant_head'])
      expect(landingPath(role), role).toBe('/analytics/today');
  });

  it('sends the operator to My complaints and the technician to Mine', () => {
    expect(landingPath('operator')).toBe('/floor/mine');
    expect(landingPath('technician')).toBe('/desk/mine');
  });

  it('sends the supervisor and admin to the Open desk, and the board to the floor', () => {
    for (const role of ['supervisor', 'admin']) expect(landingPath(role), role).toBe('/desk');
    expect(landingPath('board')).toBe('/floor');
  });

  it('sends every role that may open the desk to a desk or the face, and nobody else', () => {
    for (const role of [
      'operator',
      'technician',
      'supervisor',
      'head',
      'plant_head',
      'admin',
      'board',
    ])
      expect(mayOpenDesk(role), role).toBe(!landingPath(role).startsWith('/floor'));
  });
});

describe('who gets the Analytics entry on the desk menu', () => {
  it('is supervisor, head, plant head and admin, and nobody else', () => {
    for (const role of ['supervisor', 'head', 'plant_head', 'admin'])
      expect(readsAnalytics(role), role).toBe(true);
    for (const role of ['operator', 'technician', 'board', 'unknown'])
      expect(readsAnalytics(role), role).toBe(false);
  });
});
