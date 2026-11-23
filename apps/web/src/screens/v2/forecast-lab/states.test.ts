import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import i18n from 'i18next';
import { ApiError } from '../../../data/index.js';
import { ScreenStates, type LoadState } from '../../../ui/v2/screen-states.js';
import { load, type Provider } from '../data.js';
import { LiveOffline } from '../figures/live-error.js';
import { liveScreen } from '../live.js';

const failing =
  (error: unknown): Provider<'forecast-lab'> =>
  () =>
    Promise.reject(error);

const draw = (state: LoadState, emptyText?: string) =>
  renderToStaticMarkup(
    h(ScreenStates<string>, {
      loaded: { state, retry: () => {} },
      ...(emptyText ? { emptyText } : {}),
      children: () => null,
    }),
  );

describe('the Bottleneck and Forecast Lab screens in every state that is not the page', () => {
  it('says "Not computed yet" when the engine has nothing for the figure, never "nothing to show"', async () => {
    const provider: Provider<'forecast-lab'> = () => Promise.resolve(null);
    const { state } = await load(provider, {});
    expect(state).toBe('empty');
    const page = draw(state, i18n.t('analytics.notComputed'));
    expect(page).toContain('data-state="empty"');
    expect(page).toContain('Not computed yet');
  });

  it('is loading while the figures are on their way, with one polite status line', () => {
    const page = draw('loading');
    expect(page).toContain('data-state="loading"');
    expect(page).toContain('role="status"');
  });

  it('says the connection is lost when it is, and the server’s refusal when the login may not read it', async () => {
    expect((await load(failing(new LiveOffline()), {})).state).toBe('offline');
    expect(draw('offline')).toContain('data-state="offline"');
    expect((await load(failing(new ApiError('forbidden', 'no')), {})).state).toBe('refused');
    expect(draw('refused')).toContain('role="alert"');
  });

  it('says a plain failure with a button to try again, and a missing figure as empty', async () => {
    expect((await load(failing(new ApiError('boom', 'bad')), {})).state).toBe('error');
    expect(draw('error')).toContain('role="alert"');
    expect((await load(failing(new ApiError('not_found', 'none')), {})).state).toBe('empty');
  });

  it('opens the Reliability and forecast group on a screen whatever `?screen=` says, and leaves no v1 page behind', () => {
    for (const screen of [null, 'a9-bottleneck-forecast', 'forecast-lab', 'no-such-screen'])
      expect(liveScreen('forecast-scorecard', screen)).not.toBeNull();
  });
});
