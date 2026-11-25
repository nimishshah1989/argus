// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EntityChip } from '../entity-chip.js';
import { segmentKey } from '../segment.js';

describe('machine segments: edges', () => {
  it('ignores case, plurals and a trailing "machines" / "sets"', () => {
    expect(segmentKey('cnc machines')).toBe('cnc');
    expect(segmentKey('CNC Machines')).toBe('cnc');
    expect(segmentKey('Conventional machines')).toBe('conv');
    expect(segmentKey('Process Machines')).toBe('process');
    expect(segmentKey('ROBOT')).toBe('robot');
    expect(segmentKey('Robots')).toBe('robot');
    expect(segmentKey('Utilities')).toBe('util');
    expect(segmentKey('utility')).toBe('util');
    expect(segmentKey('DG Sets')).toBe('dg');
    expect(segmentKey('DG sets')).toBe('dg');
    expect(segmentKey('dg')).toBe('dg');
  });

  it('an unknown or empty type has no segment', () => {
    for (const name of ['Other', 'PRESS', 'Turning Center', '', '  ', null, undefined]) {
      expect(segmentKey(name)).toBeUndefined();
    }
  });

  it('seg wins over cat', () => {
    const html = renderToStaticMarkup(
      createElement(EntityChip, { kind: 'machine', id: 'm1', label: 'R-01', cat: 3, seg: 'robot' }),
    );
    expect(html).toContain('data-seg="robot"');
    expect(html).not.toContain('data-cat');
  });

  it('a chip without seg keeps its cat and has no segment', () => {
    const html = renderToStaticMarkup(
      createElement(EntityChip, { kind: 'machine', id: 'm1', label: 'X-01', cat: 2 }),
    );
    expect(html).toContain('data-cat="2"');
    expect(html).not.toContain('data-seg');
  });
});
