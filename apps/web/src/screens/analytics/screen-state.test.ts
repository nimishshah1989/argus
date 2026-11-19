import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { ApiError } from '../../data/index.js';
import { NotReady, useFiguresState, type ScreenState } from './screen-state.js';

const retry = () => {};

function Probe({ data, error }: { data?: unknown; error?: unknown }) {
  return h('p', null, useFiguresState({ data, error }));
}
const state = (props: { data?: unknown; error?: unknown }) =>
  renderToStaticMarkup(h(Probe, props)).replace(/<[^>]+>/g, '');

describe('the state of a key screen', () => {
  it('keeps "nothing here" as empty and never reads it as loading', () => {
    expect(state({ error: new ApiError('not_found', 'none') })).toBe('empty');
  });

  it('tells loading, error, offline and ready apart', () => {
    expect(state({})).toBe('loading');
    expect(state({ error: new ApiError('boom', 'bad') })).toBe('error');
    expect(state({ error: new Error('network') })).toBe('offline');
    expect(state({ data: {} })).toBe('ready');
  });

  it('draws the title above every state, the screen own words for an empty page and an alert for an error', () => {
    const draw = (state: ScreenState) =>
      renderToStaticMarkup(
        h(NotReady, { title: 'Money Matters', state, onRetry: retry, empty: 'Nothing yet' }),
      );
    for (const state of ['loading', 'offline', 'empty', 'error'] as const)
      expect(draw(state), state).toContain('<h2');
    for (const state of ['loading', 'offline', 'empty', 'error'] as const)
      expect(draw(state), state).toContain('>Money Matters</h2>');
    expect(draw('empty')).toContain('Nothing yet');
    expect(draw('error')).toContain('role="alert"');
    expect(draw('loading')).not.toContain('role="alert"');
  });
});
