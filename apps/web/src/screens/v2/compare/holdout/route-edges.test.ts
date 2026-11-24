// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import '../../../../i18n/index.js';
import { ApiError } from '../../../../data/index.js';
import type { Provider } from '../../data.js';
import { NotComputed } from '../../figures/live-error.js';
import { answerKey } from '../../printed-page/test-support.js';
import { screen } from '../register.js';

/** Ticket 588, hidden: no pair asks for the engine's own; refusals and an empty plant reach the screen states. */
const live = vi.hoisted(() => ({ next: undefined as unknown, keys: [] as unknown[] }));
vi.mock('../../figures/live.js', async (actual) => ({
  ...(await actual<typeof import('../../figures/live.js')>()),
  read: async (_client: unknown, query: { queryKey: readonly unknown[] }) => {
    live.keys.push(query.queryKey);
    if (live.next instanceof Error) throw live.next;
    return live.next;
  },
}));

const provider = screen.provider as Provider<'compare'>;
const EMPTY = {
  asOf: '2026-11-11',
  pair: null,
  options: [],
  figure: {
    ...answerKey('compare', 'compare', 43).figures[0]!,
    value: null,
    drill: { type: 'machine', ids: [] },
  },
  years: null,
  rate: null,
};

describe('Compare provider, hidden', () => {
  it('no pair in the URL asks the server for its own pair', async () => {
    live.keys = [];
    live.next = EMPTY;
    await provider({ a: '', b: '' }, { client: undefined }).catch(() => undefined);
    expect(live.keys).toEqual([['analytics-compare', '', '']]);
  });

  it('a plant with nothing to compare is not computed, never an empty page', async () => {
    live.next = EMPTY;
    await expect(provider({ a: '', b: '' }, { client: undefined })).rejects.toBeInstanceOf(
      NotComputed,
    );
  });

  it('a refusal stays the server’s error', async () => {
    live.next = new ApiError('validation', 'Choose two machines of the same kind', 'b', 422);
    await expect(
      provider({ a: 'VC-28', b: 'VC-28' }, { client: undefined }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('keeps the approved fixture for the gallery', async () => {
    const frozen = screen.frozen as Provider<'compare'>;
    const model = (await frozen({ a: 'VC-67', b: 'VC-18' }, { client: undefined }))!;
    expect(model.pick.a).toBe('VC-67');
  });

  it('nothing in the app still draws v1’s Machines page', () => {
    const face = readFileSync(new URL('../../../analytics/Analytics.tsx', import.meta.url), 'utf8');
    expect(face).not.toContain('MachinesPage');
  });
});
