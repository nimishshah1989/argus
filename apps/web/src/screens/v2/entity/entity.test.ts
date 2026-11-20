// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { DecisionDetail } from '../../../ui/v2/domain/decision-detail.js';
import { Drawer } from '../../../ui/v2/drawer.js';
import { EntityChip, type EntityRef } from '../../../ui/v2/entity-chip.js';
import { Segs, type Point } from '../../../ui/v2/points.js';
import { dashboardFixture as plant } from '../fixtures/plant-fixture.js';
import { pt } from '../fixtures/text.js';
import { entityFixture } from './fixture.js';
import { entityHref } from './href.js';
import { entityFrom, searchWith } from './url.js';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const machines = plant.cells.flatMap((c) => c.machines);

describe('the drawer in the URL', () => {
  it('reads one thing from ?drawer=kind:id, with the id as written', () => {
    expect(entityFrom('?drawer=machine:TC-12')).toEqual({ kind: 'machine', id: 'TC-12' });
    expect(entityFrom('?view=a&drawer=cell:Cell%201&x=1')).toEqual({ kind: 'cell', id: 'Cell 1' });
    expect(entityFrom('?drawer=person:neel-s')).toEqual({ kind: 'person', id: 'neel-s' });
    expect(entityFrom('?drawer=decision:a:b')).toEqual({ kind: 'decision', id: 'a:b' });
  });

  it('asks for nothing when the kind is unknown or the value is malformed', () => {
    for (const q of [
      '',
      '?drawer=',
      '?drawer=widget:1',
      '?drawer=machine',
      '?drawer=machine:',
      '?drawer=:x',
    ])
      expect(entityFrom(q)).toBeNull();
  });

  it('writes the drawer without touching the other parameters, and removes it again', () => {
    const ref: EntityRef = { kind: 'cell', id: 'Cell 1' };
    expect(searchWith('', ref)).toBe('?drawer=cell:Cell%201');
    expect(searchWith('?view=v2-dashboard&theme=dark', ref)).toBe(
      '?view=v2-dashboard&theme=dark&drawer=cell:Cell%201',
    );
    expect(searchWith('?view=v2-dashboard&drawer=machine:TC-4&theme=dark', ref)).toBe(
      '?view=v2-dashboard&theme=dark&drawer=cell:Cell%201',
    );
    expect(searchWith('?view=v2-dashboard&drawer=machine:TC-4', null)).toBe('?view=v2-dashboard');
    expect(searchWith('?drawer=machine:TC-4', null)).toBe('');
  });

  it('round-trips an id with characters that need escaping', () => {
    const ref: EntityRef = { kind: 'person', id: 'a&b=c d%e' };
    expect(entityFrom(searchWith('?x=1', ref))).toEqual(ref);
  });
});

describe('where each thing has its page', () => {
  it('says so in one place', () => {
    expect(entityHref({ kind: 'machine', id: 'TC-12' })).toBe('/analytics/machines/TC-12');
    expect(entityHref({ kind: 'decision', id: 'axis' })).toBe(
      '/analytics/today/action-center?drawer=decision:axis',
    );
    expect(entityHref({ kind: 'person', id: 'neel-s' })).toBe(
      '/analytics/today?screen=team-focus&drawer=person:neel-s',
    );
    expect(entityHref({ kind: 'cell', id: 'Cell 1' })).toBe('/analytics/machines?cell=Cell%201');
  });
});

describe('the chip', () => {
  it('is a button with its icon and label, in its type colour for a machine, and draws without a router', () => {
    const machine = html(
      createElement(EntityChip, { kind: 'machine', id: 'TC-4', label: 'TC-4', cat: 1 }),
    );
    expect(machine).toMatch(
      /^<button type="button" class="v2-entity[^"]*" data-kind="machine" data-cat="1">/,
    );
    expect(machine).toMatch(/<span class="v2-entity-label">TC-4<\/span><\/button>$/);
    const person = html(
      createElement(EntityChip, { kind: 'person', id: 'neel-s', label: 'Neel S' }),
    );
    expect(person).toMatch(/^<button type="button" class="v2-entity" data-kind="person">/);
  });

  it('is written into text as {{kind:id|label}} and prints inline among the words', () => {
    const point: Point = pt(
      'Worst on {{machine:VC-67|VC-67}}, fixed by {{person:arjun-v|Arjun V}}',
    );
    expect(point.map((s) => s.text).join('')).toBe('Worst on VC-67, fixed by Arjun V');
    expect(point[1]).toEqual({
      text: 'VC-67',
      entity: { kind: 'machine', id: 'VC-67', label: 'VC-67', cat: 2 },
    });
    const out = html(createElement(Segs, { point }));
    expect(out.match(/<button/g)).toHaveLength(2);
    expect(out).toMatch(/^<span>Worst on <\/span><button/);
  });
});

describe('the drawer footer', () => {
  const spec = (fullPage?: { href: string; label: string }) => ({
    label: 'TC-4',
    content: 'detail',
    onClose: () => {},
    fullPage,
  });
  it('offers the full page as a link, and nothing when there is none', () => {
    const out = html(
      createElement(Drawer, {
        drawer: spec({ href: '/analytics/machines/TC-4', label: 'Open full page' }),
      }),
    );
    expect(out).toMatch(
      /<footer[^>]*><a[^>]*href="\/analytics\/machines\/TC-4"[^>]*>Open full page/,
    );
    expect(html(createElement(Drawer, { drawer: spec() }))).not.toMatch(/<footer/);
  });
});

describe('the entity fixture', () => {
  it('has every machine, cell, decision and person the Dashboard names, and nothing for what it does not', () => {
    const named = new Set<string>();
    const walk = (point: Point) =>
      point.forEach((s) => s.entity && named.add(`${s.entity.kind}:${s.entity.id}`));
    for (const d of plant.decisions) {
      [d.why, d.detail, [d.owner]].flat().forEach(walk);
      d.codes.forEach((c) => named.add(`${c.kind}:${c.id}`));
    }
    [plant.verdict.why, ...plant.bullets.map((b) => b.why)].flat().forEach(walk);
    machines.forEach((m) => m.why.forEach(walk));
    expect(named.size).toBeGreaterThan(8);
    const missing = [...named].filter((k) => {
      const [kind, ...id] = k.split(':');
      return entityFixture({ kind: kind as EntityRef['kind'], id: id.join(':') }) === null;
    });
    expect(missing).toEqual([]);
    expect(entityFixture({ kind: 'machine', id: 'NOPE-1' })).toBeNull();
    expect(entityFixture({ kind: 'person', id: 'TC-4' })).toBeNull();
  });

  it('adds a cell up from its machines: its hours are theirs summed, and its count is theirs', () => {
    for (const cell of plant.cells) {
      const m = entityFixture({ kind: 'cell', id: cell.name });
      if (m?.kind !== 'cell') throw new Error(`no cell ${cell.name}`);
      const sum = cell.machines.reduce((s, x) => s + x.hours.value, 0);
      expect(m.cell.hours.value).toBeCloseTo(sum, 5);
      expect(m.cell.hours.shown).toBe(`${sum.toFixed(1)} h`.replace(' h', ' h'));
      expect(m.cell.machineCount).toContain(String(cell.machines.length));
      expect(m.cell.worst.length).toBeLessThanOrEqual(3);
    }
    const all = plant.cells.reduce((s, c) => {
      const m = entityFixture({ kind: 'cell', id: c.name });
      return s + (m?.kind === 'cell' ? m.cell.hours.value : 0);
    }, 0);
    expect(all).toBeCloseTo(312.4, 5);
  });

  it('names a drawer after the thing, so a screen reader hears what opened', () => {
    expect(entityFixture({ kind: 'machine', id: 'VC-24' })?.label).toBe(
      'Vertical machining centre 24',
    );
    expect(entityFixture({ kind: 'person', id: 'neel-s' })?.label).toBe('Neel S');
  });
});

describe('a decision opened from the port', () => {
  it('shows no Decide button unless the screen can take the decision', () => {
    const m = entityFixture({ kind: 'decision', id: plant.decisions[0]!.id });
    if (m?.kind !== 'decision') throw new Error('fixture has no decision');
    const props = { d: m.decision, words: m.words, source: m.source };
    expect(renderToStaticMarkup(createElement(DecisionDetail, props))).not.toContain(
      m.decision.action,
    );
    const act = { onDecide: () => {}, onUndo: () => {} };
    expect(renderToStaticMarkup(createElement(DecisionDetail, { ...props, ...act }))).toContain(
      m.decision.action,
    );
  });
});
