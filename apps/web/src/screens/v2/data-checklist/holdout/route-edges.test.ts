// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FiguresReply } from '@uptimo/shared/analytics';
import '../../../../i18n/index.js';
import { stateOfError, type Provider } from '../../data.js';
import { LiveOffline } from '../../figures/live-error.js';
import { realReply } from '../../figures/real-reply.js';
import { liveScreen } from '../../live.js';
import { screen } from '../register.js';

/** DC-2 (ticket 578) edges: the states v1 had, a figure that counted no tickets, and Today's other screens untouched. */
const live = vi.hoisted(() => ({ reply: undefined as unknown, offline: false }));
vi.mock('../../figures/live.js', async (actual) => ({
  ...(await actual<typeof import('../../figures/live.js')>()),
  liveReply: async () => {
    if (live.offline) throw new LiveOffline();
    return live.reply;
  },
}));

const KEY = 'data-checklist';
const provider = screen.provider as Provider<'data-checklist'>;
const run = () => provider({}, { client: undefined });
const failureOf = () =>
  run().then(
    () => null,
    (error: unknown) => error,
  );
const edited = (change: (figures: FiguresReply['figures']) => FiguresReply['figures']) => {
  const reply = realReply();
  return { ...reply, figures: change(reply.figures) } as FiguresReply;
};

beforeEach(() => {
  live.reply = realReply();
  live.offline = false;
});

describe('Data Checklist route edges (DC-2)', () => {
  it('says offline when the connection is lost, as v1 did, not "error"', async () => {
    live.offline = true;
    expect(stateOfError(await failureOf())).toBe('offline');
  });

  it('says "Not computed yet" when the reply has no checklist figure at all', async () => {
    live.reply = edited((figures) => figures.filter((figure) => figure.key !== KEY));
    expect(stateOfError(await failureOf())).toBe('notComputed');
  });

  it('has no page control when the engine named no tickets, and still lists every record', async () => {
    live.reply = edited((figures) =>
      figures.map((figure) =>
        figure.key === KEY ? { ...figure, drill: { type: 'ticket', ids: [] } } : figure,
      ),
    );
    const model = (await run())!;
    expect(model.drill).toBeUndefined();
    const items = (realReply().figures.find((f) => f.key === KEY)!.value as { items: unknown[] })
      .items;
    expect(model.records).toHaveLength(items.length);
  });

  it('leaves Today’s Dashboard as its first screen and Team Focus on v1', () => {
    expect(liveScreen('today', null)?.key).toBe('today:dashboard');
    expect(liveScreen('today', 'no-such-screen')?.key).toBe('today:dashboard');
    expect(liveScreen('today', 'team-focus')).toBeNull();
  });
});
