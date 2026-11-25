// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import i18n from '../../i18n/index.js';
import { fill } from '../../i18n/fill.js';
import { ReviewMarker } from './review-marker.js';

const html = (count: number) =>
  renderToStaticMarkup(createElement(ReviewMarker, { count, href: '/review?held=shift' }));

describe('ReviewMarker (ADR 0036 R5)', () => {
  it('says how many rows need review and links to the review tray', () => {
    const out = html(7);
    expect(out).toContain('href="/review?held=shift"');
    expect(out).toContain('data-status="watch"');
    expect(out).toContain(fill(i18n.t('insight.review.rows'), { n: 7 }));
  });

  it('renders nothing at 0', () => {
    expect(html(0)).toBe('');
  });
});
