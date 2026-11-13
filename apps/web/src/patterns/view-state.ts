import { ApiError } from '../data/index.js';

export type ViewState = 'ready' | 'empty' | 'loading' | 'error' | 'offline';

/** One answer for what a data page shows; cached data still shows offline. */
export function viewState(input: {
  online: boolean;
  hasData: boolean;
  isEmpty: boolean;
  error: unknown;
}): ViewState {
  if (input.hasData) return input.isEmpty ? 'empty' : 'ready';
  if (input.error instanceof ApiError) return input.error.code === 'not_found' ? 'empty' : 'error';
  if (!input.online || input.error) return 'offline';
  return 'loading';
}

export function offlineNotice(
  online: boolean,
  offlineAllowed: boolean,
): 'kit.form.offlineQueued' | 'kit.form.needsConnection' | null {
  if (online) return null;
  return offlineAllowed ? 'kit.form.offlineQueued' : 'kit.form.needsConnection';
}
