// @vitest-environment node
import { describe, expect, it } from 'vitest';
import '../../../../i18n/index.js';
import type { EntityChipProps } from '../../../../ui/v2/entity-chip.js';
import { teamFocusFixture } from '../fixture.js';
import type { ActionRow, PersonLoad, TeamFocusModel } from '../model.js';
import { teamFocusSheets } from '../sweep.js';

/** The edges of Team Focus's sweep helper (706 batch A): empty tables, ties, missing owner, role and note. */
const chip = (label: string) =>
  ({ kind: 'machine', id: label, label }) as unknown as EntityChipProps;
const person = (label: string, role: string, open: number, hours: number): PersonLoad =>
  ({
    chip: chip(label),
    role,
    open,
    hours: { shown: `${hours} hrs`, value: hours },
    done: 0,
    load: null,
    loadLabel: '',
  }) as PersonLoad;
const action = (title: string, hours: number, over: Partial<ActionRow> = {}): ActionRow =>
  ({
    id: title,
    kind: 'pm',
    kindLabel: 'PM',
    title,
    chips: [],
    owner: null,
    status: 'todo',
    statusLabel: 'To do',
    hours: { shown: `${hours}`, value: hours },
    note: '',
    ...over,
  }) as ActionRow;
const withRows = (people: PersonLoad[], actions: ActionRow[]): TeamFocusModel => ({
  ...teamFocusFixture,
  people,
  actions,
});

describe('teamFocusSheets edges', () => {
  it('empty tables still give both sheets, header rows only', () => {
    const sheets = teamFocusSheets(withRows([], []));
    expect(sheets).toHaveLength(2);
    expect(sheets.map((s) => s.rows.length)).toEqual([1, 1]);
  });

  it('keeps the model order on ties, and never mutates the model', () => {
    const people = [person('A', '', 2, 1), person('B', 'Fitter', 3, 1), person('C', '', 2, 1)];
    const actions = [action('x', 1.25), action('y', 4), action('z', 1.25)];
    const model = withRows(people, actions);
    const [p, a] = teamFocusSheets(model);
    expect(p!.rows.slice(1).map((r) => r[0])).toEqual(['B · Fitter', 'A', 'C']);
    expect(a!.rows.slice(1).map((r) => r[0])).toEqual(['PM · y', 'PM · x', 'PM · z']);
    expect(model.people.map((x) => x.chip.label)).toEqual(['A', 'B', 'C']);
    expect(model.actions.map((x) => x.title)).toEqual(['x', 'y', 'z']);
  });

  it('writes the exact hours, never the rounded print', () => {
    const [p, a] = teamFocusSheets(withRows([person('A', '', 1, 6.087)], [action('x', 6.087)]));
    expect(p!.rows[1]![2]).toBe(6.087);
    expect(a!.rows[1]![3]).toBe(6.087);
  });

  it('names the machines and the note in the action, and says no owner in words', () => {
    const [, a] = teamFocusSheets(
      withRows(
        [],
        [action('Change the belt', 2, { chips: [chip('VMC-3'), chip('VMC-4')], note: 'ordered' })],
      ),
    );
    expect(a!.rows[1]).toEqual([
      'PM · VMC-3 · VMC-4 · Change the belt · ordered',
      teamFocusFixture.words.actions.noOwner,
      'To do',
      2,
    ]);
  });
});
