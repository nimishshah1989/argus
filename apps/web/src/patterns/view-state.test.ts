import { describe, expect, it } from 'vitest';
import { ApiError } from '../data/index.js';
import { offlineNotice, viewState } from './view-state.js';

const base = { online: true, hasData: false, isEmpty: false, error: null as unknown };

describe('viewState', () => {
  it('viewState picks ready, empty, loading, error and offline', () => {
    expect(viewState({ ...base, hasData: true })).toBe('ready');
    expect(viewState({ ...base, hasData: true, isEmpty: true })).toBe('empty');
    expect(viewState({ ...base, online: false, hasData: true })).toBe('ready');
    expect(viewState({ ...base, error: new ApiError('not_found', 'x') })).toBe('empty');
    expect(viewState({ ...base, error: new ApiError('internal', 'x') })).toBe('error');
    expect(viewState({ ...base, error: new TypeError('Failed to fetch') })).toBe('offline');
    expect(viewState({ ...base, online: false })).toBe('offline');
    expect(viewState(base)).toBe('loading');
  });
});

describe('offlineNotice', () => {
  it('queued when allowed, needs a connection otherwise', () => {
    expect(offlineNotice(true, true)).toBeNull();
    expect(offlineNotice(true, false)).toBeNull();
    expect(offlineNotice(false, true)).toBe('kit.form.offlineQueued');
    expect(offlineNotice(false, false)).toBe('kit.form.needsConnection');
  });
});
