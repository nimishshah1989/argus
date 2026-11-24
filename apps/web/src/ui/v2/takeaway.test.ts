// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExpandRow, Takeaway } from './takeaway.js';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe('Takeaway', () => {
  it('says the tone in a word and an icon, then the sentence', () => {
    const out = html(
      createElement(Takeaway, {
        data: { text: 'Shift C loses 2.4× Shift A', tone: 'loss', tag: 'Loss' },
      }),
    );
    expect(out).toContain('data-tone="loss"');
    expect(out).toContain('v2-pill-loss');
    expect(out).toContain('<svg');
    expect(out).toMatch(/Loss<\/span?>?/);
    expect(out).toContain('Shift C loses 2.4× Shift A');
  });
});

describe('ExpandRow', () => {
  const out = html(
    createElement(ExpandRow, {
      head: 'Machine 12',
      label: 'Machine 12: show detail',
      children: 'Spindle 3 h',
    }),
  );
  it('is a button that says it is closed and names the region it controls', () => {
    expect(out).toMatch(/<button[^>]*type="button"/);
    expect(out).toContain('aria-expanded="false"');
    const id = /aria-controls="([^"]+)"/.exec(out)?.[1];
    expect(out).toContain(`id="${id}"`);
  });
  it('keeps the detail in the page, hidden while closed', () => {
    expect(out).toMatch(/<div[^>]*hidden=""[^>]*>Spindle 3 h/);
  });
  it('opens on request', () => {
    const open = html(
      createElement(ExpandRow, { head: 'x', label: 'x', defaultOpen: true, children: 'detail' }),
    );
    expect(open).toContain('aria-expanded="true"');
    expect(open).not.toContain('hidden=""');
  });
});
