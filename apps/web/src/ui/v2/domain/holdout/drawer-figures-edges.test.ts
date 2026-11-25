// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../../i18n/index.js';
import type { DecisionData } from '../decision-row.js';
import { DecisionDetail } from '../decision-detail.js';
import { DetailFigures } from '../detail-parts.js';
import { MachineDetail } from '../machine-detail.js';
import type { MachineData } from '../plant.js';

const count = (html: string, part: string) => html.split(part).length - 1;
const FULL = { href: '/full', label: 'Full page' };
const machine: MachineData = {
  code: 'TC-30',
  name: 'Turning centre 30',
  typeLabel: 'CNC',
  cat: 1,
  cell: 'Cell 8',
  state: 'run',
  hours: { shown: '21.4 h', value: 21.4 },
  stops: 3,
  trend: [],
  why: [],
};
const MACHINE_WORDS = {
  states: { run: 'Running', risk: 'At risk', down: 'Down', pm: 'PM', idle: 'Idle' },
  figures: 'Figures',
  hours: 'Hours',
  stops: 'Stops',
  trend: 'Trend',
  why: 'Why',
};

describe('entity drawers, hidden (ADR 0041, was ticket 705)', () => {
  it('a figure with no value is dropped before the cap, never a dash filling a slot', () => {
    const figures = [
      { label: 'Empty', value: '' },
      { label: 'Missing' },
      { label: 'One', value: '1' },
      { label: 'Two', value: '2' },
      { label: 'Three', value: '3' },
      { label: 'Four', value: '4' },
    ];
    const html = renderToStaticMarkup(h(DetailFigures, { figures }));
    expect(count(html, 'v2-kpi-value')).toBe(3);
    expect(html).not.toContain('Empty');
    expect(html).not.toContain('Missing');
    expect(html).toContain('Three');
    expect(html).not.toContain('Four');
  });

  it('fewer than 3 figures show as they are; none left draws nothing', () => {
    expect(
      count(
        renderToStaticMarkup(h(DetailFigures, { figures: [{ label: 'A', value: '1' }] })),
        'v2-kpi-value',
      ),
    ).toBe(1);
    expect(renderToStaticMarkup(h(DetailFigures, { figures: [{ label: 'A', value: '' }] }))).toBe(
      '',
    );
    expect(renderToStaticMarkup(h(DetailFigures, { figures: [] }))).toBe('');
  });

  it('a machine drawer with its full page has one link, after the figures and before the source line', () => {
    const html = renderToStaticMarkup(
      h(MachineDetail, { m: machine, words: MACHINE_WORDS, source: 'SOURCE-LINE', full: FULL }),
    );
    expect(count(html, 'data-full-page')).toBe(1);
    expect(html.indexOf('data-full-page')).toBeGreaterThan(html.indexOf('v2-kpi-value'));
    expect(html.indexOf('data-full-page')).toBeLessThan(html.indexOf('SOURCE-LINE'));
  });

  it('a drawer without a full page draws no link (screens pass it in the adoption batches)', () => {
    const html = renderToStaticMarkup(
      h(MachineDetail, { m: machine, words: MACHINE_WORDS, source: 's' }),
    );
    expect(html).not.toContain('data-full-page');
  });

  it('a decision drawer with its full page has exactly one link', () => {
    const d: DecisionData = {
      id: 'd1',
      kind: 'fix',
      kindLabel: 'Fix',
      codes: [],
      title: 'Replace spindle bearing',
      keys: [],
      why: [],
      hours: '12 h',
      money: 'Rs 1.2 L',
      days: [],
      stripLabel: '',
      action: 'Decide',
      doneText: 'Done',
      owner: [{ text: 'Maintenance' }],
      detail: [],
      decided: false,
    };
    const words = {
      worth: 'Worth',
      perMonth: 'Month',
      perYear: 'Year',
      last90: '90 days',
      stripCaption: '',
      why: 'Why',
    };
    const html = renderToStaticMarkup(h(DecisionDetail, { d, words, source: 's', full: FULL }));
    expect(count(html, 'data-full-page')).toBe(1);
  });
});
