// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActionStrips, topStrips, type Severity, type Strip } from '../action-strip.js';

const strip = (key: string, count: number, severity: Severity): Strip => ({
  key,
  count,
  what: key,
  href: `/${key}`,
  link: key,
  severity,
});

describe('ActionStrips: edges', () => {
  it('drops a count of 0 and a negative count', () => {
    expect(
      topStrips([strip('a', 0, 'high'), strip('b', -1, 'medium'), strip('c', 1, 'low')]).map(
        (s) => s.key,
      ),
    ).toEqual(['c']);
  });

  it('keeps the input order within a severity', () => {
    const kept = topStrips([
      strip('m1', 9, 'medium'),
      strip('h1', 1, 'high'),
      strip('m2', 1, 'medium'),
      strip('h2', 9, 'high'),
    ]);
    expect(kept.map((s) => s.key)).toEqual(['h1', 'h2', 'm1']);
  });

  it('cuts more than 3 to the 3 worst', () => {
    const kept = topStrips([
      strip('l1', 1, 'low'),
      strip('m1', 1, 'medium'),
      strip('h1', 1, 'high'),
      strip('l2', 1, 'low'),
      strip('m2', 1, 'medium'),
    ]);
    expect(kept.map((s) => s.key)).toEqual(['h1', 'm1', 'm2']);
    const html = renderToStaticMarkup(
      createElement(ActionStrips, { strips: kept.concat(strip('l3', 1, 'low')) }),
    );
    expect(html.match(/<a /g)).toHaveLength(3);
    expect(html).not.toContain('href="/l3"');
  });

  it('renders nothing when there are no strips or all are 0', () => {
    expect(renderToStaticMarkup(createElement(ActionStrips, { strips: [] }))).toBe('');
    expect(
      renderToStaticMarkup(
        createElement(ActionStrips, { strips: [strip('a', 0, 'high'), strip('b', 0, 'low')] }),
      ),
    ).toBe('');
  });
});
