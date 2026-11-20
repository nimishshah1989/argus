import { describe, expect, it } from 'vitest';
import { mayWrite, rowTicketId, shownName, type Table, type Viewer } from './why-why-parts.js';

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

describe("a candidate row's ticket", () => {
  const table = (rowTicketIds?: string[]): Table => ({
    title: 'Why-Why (Root Cause) Analysis',
    header: ['Machine', 'Date', 'Problem', 'Down (Hrs)', 'Status', ''],
    rows: [
      ['TC-2', '13-06-2026', 'geometry problem', '238.58', 'Not Started', 'Start Why-Why'],
      ['TC-5', '23-04-2026', 'alarm', '154.75', 'Not Started', 'Start Why-Why'],
    ],
    rowCount: 2,
    truncated: false,
    ...(rowTicketIds === undefined ? {} : { rowTicketIds }),
  });

  it("is the id printed beside that row, whatever order the figure's sorted drill lists the tickets in", () => {
    // The worst-hours row's ticket sorts after the second row's: reading by position in the drill would swap them.
    const found = table(['zzzz', 'aaaa']);
    expect(rowTicketId(found, 0)).toBe('zzzz');
    expect(rowTicketId(found, 1)).toBe('aaaa');
  });

  it('is none when the figure names no ticket for the row, so no action is offered', () => {
    expect(rowTicketId(table(), 0)).toBeNull();
    expect(rowTicketId(table(['zzzz']), 1)).toBeNull();
    expect(rowTicketId(table(['']), 0)).toBeNull();
  });
});
