// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActionStrips, topStrips, type Severity, type Strip } from './action-strip.js';

const strip = (key: string, count: number, severity: Severity): Strip => ({
  key,
  count,
  what: `${key} items`,
  href: `/${key}`,
  link: `Open ${key}`,
  severity,
});

describe('ActionStrips (ADR 0036 R2)', () => {
  it('drops empty strips and puts the worst first', () => {
    const kept = topStrips([
      strip('low', 2, 'low'),
      strip('none', 0, 'high'),
      strip('medium', 5, 'medium'),
      strip('high', 3, 'high'),
    ]);
    expect(kept.map((s) => s.key)).toEqual(['high', 'medium', 'low']);
  });

  it('shows each kept strip with its count and link, and no dropped one', () => {
    const html = renderToStaticMarkup(
      createElement(ActionStrips, {
        strips: [strip('pm', 0, 'high'), strip('nudges', 3, 'high'), strip('review', 7, 'low')],
      }),
    );
    expect(html).toContain('href="/nudges"');
    expect(html).toContain('href="/review"');
    expect(html).not.toContain('href="/pm"');
    expect(html).toContain('<strong>3</strong>');
    expect(html).toContain('<strong>7</strong>');
    expect(html).toContain('data-severity="high"');
    expect(html).toContain('data-severity="low"');
  });
});
