// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { en } from '@uptimo/shared/i18n';
import { fill } from '../../i18n/fill.js';
import { stateOfError, type Provider, type ScreenKey } from './data.js';
import { realReply } from './figures/real-reply.js';

const live = vi.hoisted(() => ({ reply: undefined as unknown }));
vi.mock('./figures/live.js', () => ({
  liveReply: async () => live.reply,
  catalogue: (key: string, values?: Record<string, unknown>) =>
    fill((en as Record<string, string>)[key] ?? key, values ?? {}),
}));
vi.mock('./fix-finder/live.js', async () => {
  const { fixFinderModel } = await import('./fix-finder/adapter.js');
  const { en: words } = await import('@uptimo/shared/i18n');
  return {
    fixFinderFromReply: (reply: FiguresReply) =>
      fixFinderModel(
        reply,
        ((key: string) => (words as Record<string, string>)[key] ?? key) as never,
      ),
  };
});
vi.mock('./problem-analysis/live.js', async () => {
  const { problemAnalysisModel } = await import('./problem-analysis/adapter.js');
  const { en: words } = await import('@uptimo/shared/i18n');
  return {
    problemAnalysisFromReply: (reply: FiguresReply) =>
      problemAnalysisModel(
        reply,
        ((key: string) => (words as Record<string, string>)[key] ?? key) as never,
      ),
  };
});

const SCREENS: [ScreenKey, string, () => Promise<{ screen: { provider: unknown } }>][] = [
  ['machines-register', 'registers', () => import('./machines-register/register.js')],
  ['age', 'a8-age', () => import('./age/register.js')],
  ['footprint', 'a7-footprint', () => import('./footprint/register.js')],
  ['fix-finder', 'fix-finder', () => import('./fix-finder/register.js')],
  ['problem-analysis', 'a10-problems', () => import('./problem-analysis/register.js')],
];

const withStatus = (key: string, status: 'ready' | 'not_computed'): FiguresReply => {
  const reply = realReply();
  return {
    ...reply,
    figures: reply.figures.map((figure) => (figure.key === key ? { ...figure, status } : figure)),
  } as FiguresReply;
};

beforeEach(() => {
  live.reply = undefined;
});

describe('a live screen says "Not computed yet" for a figure the engine did not compute', () => {
  for (const [name, key, load] of SCREENS) {
    it(`${name}: not computed is its own state; a computed figure still loads`, async () => {
      const provider = (await load()).screen.provider as Provider<never>;
      live.reply = withStatus(key, 'not_computed');
      const failure = await provider({} as never, { client: undefined }).then(
        () => null,
        (error: unknown) => error,
      );
      expect(stateOfError(failure), name).toBe('notComputed');
      live.reply = withStatus(key, 'ready');
      expect(await provider({} as never, { client: undefined }), name).not.toBeNull();
    });
  }
});
