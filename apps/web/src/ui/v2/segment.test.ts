// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EntityChip } from './entity-chip.js';
import { SEGMENTS, segmentKey, segmentVar } from './segment.js';

describe('machine segments (ADR 0036 R23)', () => {
  it('names each segment from its machine type', () => {
    expect(segmentKey('CNC')).toBe('cnc');
    expect(segmentKey('Conventional')).toBe('conv');
    expect(segmentKey('Process')).toBe('process');
    expect(segmentKey('Robot')).toBe('robot');
    expect(segmentKey('Utility')).toBe('util');
    expect(segmentKey('DG')).toBe('dg');
  });

  it('points each segment at its own colour token', () => {
    expect(SEGMENTS.map(segmentVar)).toEqual([
      'var(--color-v2-seg-cnc)',
      'var(--color-v2-seg-conv)',
      'var(--color-v2-seg-process)',
      'var(--color-v2-seg-robot)',
      'var(--color-v2-seg-util)',
      'var(--color-v2-seg-dg)',
    ]);
  });

  it('a chip carries its segment', () => {
    const html = renderToStaticMarkup(
      createElement(EntityChip, { kind: 'machine', id: 'm1', label: 'CNC-01', seg: 'cnc' }),
    );
    expect(html).toContain('data-seg="cnc"');
  });
});
