// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import i18n from '../../../i18n/index.js';
import { fill } from '../../../i18n/fill.js';
import { ReviewMarker } from '../review-marker.js';

const html = (count: number) =>
  renderToStaticMarkup(createElement(ReviewMarker, { count, href: '/review' }));

describe('ReviewMarker: edges', () => {
  it('a negative count renders nothing', () => {
    expect(html(-2)).toBe('');
  });
  it('1 uses the singular, 2 the plural', () => {
    expect(html(1)).toContain(i18n.t('insight.review.row'));
    expect(html(1)).not.toContain(fill(i18n.t('insight.review.rows'), { n: 1 }));
    expect(html(2)).toContain(fill(i18n.t('insight.review.rows'), { n: 2 }));
    expect(html(2)).toContain('href="/review"');
  });
});
