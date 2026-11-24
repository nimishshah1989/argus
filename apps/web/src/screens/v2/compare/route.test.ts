// @vitest-environment node
import { existsSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../i18n/index.js';
import { answerKey } from '../printed-page/test-support.js';
import type { Provider } from '../data.js';
import { liveScreen } from '../live.js';
import { screen } from './register.js';

/**
 * CMP-5 (ticket 588, ADR 0021): v2 Compare is the page at `/analytics/machines?screen=compare`, on
 * `GET /analytics/compare`, and v1's Machines page is gone.
 */
const live = vi.hoisted(() => ({ reply: undefined as unknown, keys: [] as unknown[] }));
vi.mock('../figures/live.js', async (actual) => ({
  ...(await actual<typeof import('../figures/live.js')>()),
  read: async (_client: unknown, query: { queryKey: readonly unknown[] }) => {
    live.keys.push(query.queryKey);
    return live.reply;
  },
}));

const M28 = '10000000-0000-0000-0000-000000000028';
const M22 = '10000000-0000-0000-0000-000000000022';
const year = (code: string, machineId: string, hours: number) => ({
  machineId,
  code,
  category: 'Vertical Machining Center',
  cell: 'Cell 1',
  age: 6,
  count: 4,
  hours,
  plannedHours: 5000,
  causes: [{ code: 'ATC', count: 4, hours }],
  weekly: Array.from({ length: 12 }, () => 0),
  last: { count: 2, hours: 2 },
});
const REPLY = {
  asOf: '2026-11-11',
  pair: { a: 'VC-22', b: 'VC-28' },
  options: ['VC-28', 'VC-22'],
  figure: {
    ...answerKey('compare', 'compare', 43).figures[0]!,
    drill: { type: 'machine', ids: [M22, M28] },
  },
  years: [year('VC-22', M22, 9), year('VC-28', M28, 3)],
  rate: null,
};
const provider = screen.provider as Provider<'compare'>;

beforeEach(() => {
  live.reply = REPLY;
  live.keys = [];
});

describe('Compare goes live (CMP-5)', () => {
  it('is the v2 screen at v1’s address', () => {
    expect(liveScreen('machines', 'compare')?.key).toBe('machines:compare');
  });

  it('builds the page from the server’s comparison of the asked pair, not from the fixture', async () => {
    const model = (await provider({ a: 'VC-22', b: 'VC-28' }, { client: undefined }))!;
    expect(live.keys).toEqual([['analytics-compare', 'VC-22', 'VC-28']]);
    expect(model.pick.a).toBe('VC-22');
    expect(model.boxes.map((box) => box.chip.label)).toEqual(['VC-22', 'VC-28']);
    expect(model.source).toContain('11-Nov-2026');
    expect(model.tables?.items.length).toBe(6);
  });

  it('deletes v1’s Machines page in the same change', () => {
    expect(existsSync(new URL('../../analytics/MachinesPage.tsx', import.meta.url))).toBe(false);
  });
});
