import { describe, expect, it } from 'vitest';
import { teamFocusFixture } from '../fixture.js';
import type { ActionRow, TeamFocusModel } from '../model.js';
import { laneTally, noteBody, ownerRows } from '../writes.js';

/** TF-3 hidden: the edges of a save and of the drawers' counts. */

const row = (id: string, over: Partial<ActionRow> = {}): ActionRow => ({
  id,
  kind: 'plan',
  kindLabel: 'Why-Why due',
  title: `Action ${id}`,
  chips: [],
  owner: null,
  status: 'todo',
  statusLabel: 'Not started',
  hours: { shown: '1.0 h', value: 1 },
  note: '',
  ...over,
});
const person = (name: string) => ({ kind: 'person' as const, id: `owner:${name}`, label: name });
const model = (actions: ActionRow[]): TeamFocusModel => ({ ...teamFocusFixture, actions });

describe('Team Focus writes: edges', () => {
  it('takes an owner back to nobody without touching the status or the note', () => {
    const m = model([row('a', { owner: person('Neel S'), status: 'doing', note: 'n' })]);
    expect(noteBody(m, '2026-12', 'a', { owner: '' })).toEqual({
      period: '2026-12',
      action: 'a',
      status: 'prog',
      owner: '',
      note: 'n',
    });
  });

  it('saves "not needed" as the stored word and keeps an action key with odd characters whole', () => {
    const key = 'fixm|m 1/2%|Coolant_leak';
    const m = model([row(key)]);
    expect(noteBody(m, '2027-01', key, { status: 'skip' })).toMatchObject({
      period: '2027-01',
      action: key,
      status: 'skip',
    });
  });

  it('counts an action in progress as open in its lane, and lanes apart', () => {
    const m = model([
      row('a', { status: 'doing' }),
      row('b', { status: 'skip' }),
      row('c', { kindLabel: 'Fix the record' }),
    ]);
    expect(laneTally(m, 'b')).toEqual({ open: 1, total: 2 });
    expect(laneTally(m, 'c')).toEqual({ open: 1, total: 1 });
  });

  it('finds no actions for an empty owner id or an owner the month does not name', () => {
    const m = model([row('a', { owner: person('Neel S') })]);
    expect(ownerRows(m, 'owner:')).toEqual([]);
    expect(ownerRows(m, 'owner:Neel')).toEqual([]);
    expect(ownerRows(m, 'owner:Neel S').map((r) => r.id)).toEqual(['a']);
  });
});
