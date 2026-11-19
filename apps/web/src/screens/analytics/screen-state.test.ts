import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { ApiError } from '../../data/index.js';
import { NotReady, useFiguresState } from './screen-state.js';

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

  it('draws the screen own words for an empty page, and the title above every state', () => {
    const page = renderToStaticMarkup(
      h(NotReady, { title: 'Money Matters', state: 'empty', onRetry: retry, empty: 'Nothing yet' }),
    );
    expect(page).toContain('Nothing yet');
    expect(page).toContain('Money Matters');
    expect(
      renderToStaticMarkup(h(NotReady, { title: 'T', state: 'error', onRetry: retry })),
    ).toContain('role="alert"');
  });
});
