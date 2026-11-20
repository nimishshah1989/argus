// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { ScreenStates, type LoadState } from '../../../ui/v2/screen-states.js';
import { EntityShell } from '../entity/EntityShell.js';

const nav = [{ id: 'm', label: 'Machines', icon: 'machines' as const, href: '/a', current: true }];

/** A screen in one state, with the rows panel asked for in the address: what a reader sees on an old link or a shared one. */
function screen(state: LoadState, url: string): string {
  const loaded = { state, retry: () => {}, model: state === 'ready' ? 'the register' : undefined };
  return renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client: new QueryClient() },
      h(
        MemoryRouter,
        { initialEntries: [url] },
        h(EntityShell, {
          nav,
          title: 'Machines register',
          children: h(ScreenStates<string>, {
            loaded,
            children: (model: string) => h('p', null, model),
          }),
        }),
      ),
    ),
  );
}

const OPEN = '/?drawer=figure:registers';
const drawerOpen = (html: string) =>
  /<aside class="v2-drawer"[^>]*>/.exec(html)?.[0].includes('inert') === false;

describe('a drill opened on the registers still opens its rows, whatever the page is showing', () => {
  it('opens the rows panel when the register is ready', () => {
    const html = screen('ready', OPEN);
    expect(html).toContain('the register');
    expect(drawerOpen(html)).toBe(true);
  });

  it('opens it when the register is not computed, and the page says so', () => {
    const html = screen('notComputed', OPEN);
    expect(html).toContain('Not computed yet');
    expect(drawerOpen(html)).toBe(true);
  });

  it('opens it when the register has nothing to show, and the page says that instead', () => {
    const html = screen('empty', OPEN);
    expect(html).toContain('Nothing to show here yet');
    expect(html).not.toContain('Not computed yet');
    expect(drawerOpen(html)).toBe(true);
  });

  it('leaves the panel closed when the address does not ask for it', () => {
    expect(drawerOpen(screen('ready', '/'))).toBe(false);
  });
});
