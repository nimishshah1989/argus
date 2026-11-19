// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Button, ButtonLink } from './button.js';
import { Card } from './card.js';
import { Select } from './input.js';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe('card options', () => {
  it('keeps its padding and title by default', () => {
    const out = html(createElement(Card, { title: 'Hours', children: 'inside' }));
    expect(out).toContain('p-4');
    expect(out).toContain('>Hours</h3>');
  });

  it('can run to its edges and be named as a region without a title', () => {
    const out = html(
      createElement(Card, { ariaLabel: 'Board column', padded: false, children: 'inside' }),
    );
    expect(out).not.toContain('p-4');
    expect(out).toContain('aria-label="Board column"');
    expect(out).toContain('inside');
    expect(out).not.toContain('<h3');
  });
});

describe('select width', () => {
  it('fills its row by default and sizes to its options when asked to fit', () => {
    const full = html(createElement(Select, { 'aria-label': 'Sort' }));
    const fit = html(createElement(Select, { 'aria-label': 'Sort', fit: true }));
    expect(full).toContain('w-full');
    expect(fit).toContain('w-auto');
    expect(fit).not.toContain('w-full');
    expect(fit).not.toContain('fit=');
    expect(fit).toContain('min-h-target');
  });
});

describe('link that looks like a button', () => {
  it('is an anchor with the button look, the 52 px target and its words', () => {
    const out = html(
      createElement(ButtonLink, { href: 'https://example.test/x', children: 'Open guide' }),
    );
    expect(out).toMatch(/^<a href="https:\/\/example.test\/x"/);
    expect(out).toContain('Open guide');
    expect(out).toContain('min-h-target');
    expect(out).toContain('bg-accent-strong');
  });

  it('keeps the 44 px target for the quiet look', () => {
    const out = html(createElement(ButtonLink, { href: '/a', variant: 'quiet', children: 'More' }));
    expect(out).toContain('min-h-target-min');
  });

  it('goes inside the app by a router link, with the same classes as a Button', () => {
    const link = html(
      createElement(
        MemoryRouter,
        null,
        createElement(ButtonLink, { to: '/today', children: 'Today' }),
      ),
    );
    expect(link).toContain('href="/today"');
    const button = html(createElement(Button, null, 'Today'));
    const classes = (s: string) => /class="([^"]*)"/.exec(s)?.[1] ?? '';
    const linkTokens = classes(link).split(' ');
    for (const name of classes(button).split(' ')) expect(linkTokens).toContain(name);
  });
});
