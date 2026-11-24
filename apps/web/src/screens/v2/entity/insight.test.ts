// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import type { Machine, Person } from '@uptimo/shared/config';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';
import { fill } from '../../../i18n/fill.js';
import { realReply } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { hasYardstick, tilesIn } from '../insight.js';
import { entityModel, type EntityFacts } from './adapter.js';
import { EntityDetail } from './Detail.js';

/**
 * ADR 0035 (ticket 666): the cell drawer opens with a takeaway over every machine in the cell, not the three it lists;
 * the machine and person drawers have no set to compare and no line. The facts are built as `adapter.test.ts` builds
 * them. Critical tests only (ADR 0034): the figures, measured on the frozen 11 Nov reply, never wording.
 */
const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const machines: Machine[] = ENGINE_DATA.machines.map((m) => ({
  id: m.id,
  code: m.code,
  category: m.category,
  cell: m.cell,
  segment_id: null,
  group_id: null,
  criticality: null,
}));
const people: Person[] = [
  { id: 'p-1', name: 'Person 51', team: 'Maintenance', title: 'Technician', active: true },
];
const facts: EntityFacts = { machines, people, open: [], reply: realReply() };
const tracked = ENGINE_DATA.machines.find(
  (m) => m.segment === 'CNC' && !m.excludedFromProduction && m.cell,
)!;
const cell = (id: string) => entityModel({ kind: 'cell', id }, facts, t);
const has = (id: string, figures: string[]) => {
  for (const figure of figures)
    expect(cell(id)?.takeaways?.worst?.text ?? '', `cell ${id}`).toContain(figure);
};

describe('Entity drawer insight (ticket 666)', () => {
  it('opens the cell drawer with one takeaway, and has no tiles to measure', () => {
    const model = cell(tracked.cell!);
    expect(tracked.cell).toBe('7');
    expect(Object.keys(model?.takeaways ?? {})).toEqual(['worst']);
    expect(model?.takeaways?.worst?.text.length).toBeGreaterThan(0);
    expect(tilesIn(model).filter((tile) => !hasYardstick(tile))).toEqual([]);
  });

  it('reads every machine in the cell, not the three it lists', () => {
    const model = cell('7');
    if (model?.kind !== 'cell') throw new Error('not a cell');
    expect(model.cell.worst).toHaveLength(3);
    has('7', ['3', '33', '50%']);
    has('5', ['1', '6', '88%']);
    has('8', ['TC-30', '12.0', '21.4 h']);
  });

  it('says nothing on the machine and person drawers, which have no set to compare', () => {
    const machine = entityModel({ kind: 'machine', id: tracked.code }, facts, t);
    const person = entityModel({ kind: 'person', id: 'p-1' }, facts, t);
    expect(machine?.kind).toBe('machine');
    expect(person?.kind).toBe('person');
    expect(Object.keys(machine?.takeaways ?? {})).toEqual([]);
    expect(Object.keys(person?.takeaways ?? {})).toEqual([]);
  });

  it('draws the cell’s takeaway in the drawer', () => {
    const model = cell('7')!;
    const html = renderToStaticMarkup(h(EntityDetail, { model }));
    expect(html.includes(model.takeaways?.worst?.text ?? '∅')).toBe(true);
  });
});
