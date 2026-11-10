/**
 * Cached reads (SPEC 1.9): the last `/state` and `/config` responses are kept so the desk and
 * the floor still render when the phone has no signal. localStorage is enough for two payloads.
 */
import type { Config, State } from '../api.js';

const STATE_KEY = 'uptimo.cache.state';
const CONFIG_KEY = 'uptimo.cache.config';

interface Cached<T> {
  at: string;
  data: T;
}

function storage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function save<T>(key: string, data: T): void {
  const target = storage();
  if (!target) return;
  try {
    target.setItem(key, JSON.stringify({ at: new Date().toISOString(), data }));
  } catch {
    // Quota or private mode: show live data rather than fail the screen.
  }
}

function read<T>(key: string): T | null {
  const target = storage();
  if (!target) return null;
  try {
    const raw = target.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached<T>;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export interface CacheOptions<T> {
  cached: T | null;
  offline: boolean;
  load: () => Promise<T>;
  save: (value: T) => void;
  isHttpError: (error: unknown) => boolean;
}

/** Cache-first read: offline, or a network failure, serves the last response instead of failing. */
export async function cacheFirst<T>(options: CacheOptions<T>): Promise<T> {
  if (options.offline && options.cached) return options.cached;
  try {
    const value = await options.load();
    options.save(value);
    return value;
  } catch (error) {
    if (options.cached && !options.isHttpError(error)) return options.cached;
    throw error;
  }
}

export function saveState(state: State): void {
  save(STATE_KEY, state);
}

export function readState(): State | null {
  return read<State>(STATE_KEY);
}

export function cachedTicketRef(ticketId: string): string | null {
  const ticket = readState()?.open.find((item) => item.id === ticketId);
  return ticket?.ref ?? null;
}

export function saveConfig(config: Config): void {
  save(CONFIG_KEY, config);
}

export function readConfig(): Config | null {
  return read<Config>(CONFIG_KEY);
}
