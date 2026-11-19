import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tag, type TagSpec } from './tags.js';

/**
 * The tag as markup for an ECharts tooltip, which cannot hold a component: the same `Tag`, rendered to a string, so
 * a tone shows the same icon and classes in a tooltip as on the page. Its own file, not in the elements barrel, so
 * a bundle that does not draw tooltips does not carry the string renderer.
 */
export function tagHtml(tag: TagSpec): string {
  return renderToStaticMarkup(createElement(Tag, { tag }));
}
