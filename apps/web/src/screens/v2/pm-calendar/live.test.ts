// @vitest-environment node
import { QueryClient } from '@tanstack/react-query';
import { keepOwners } from '../../../data/person-cache.js';
import { en } from '@uptimo/shared/i18n';
import i18n from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../i18n/index.js';
import { realReply, UUID } from '../figures/real-reply.js';
import { COMPLIANCE, TODAY, calendarFor } from './stand-in.js';
import type { PmCalendarModel } from './model.js';

const server = vi.hoisted(() => ({
  role: 'head',
  reads: 0,
  figures: undefined as unknown,
  reversed: false,
}));

vi.mock('../../../api.js', async (original) => ({
  ...(await original<typeof import('../../../api.js')>()),
  getMe: async () => ({ user: { role: server.role } }),
  pmCalendarQuery: (range: { from: string; to: string }) => ({
    queryKey: ['pm-calendar', range.from, range.to],
    queryFn: async () => {
      server.reads += 1;
      const reply = calendarFor(range);
      return server.reversed ? { ...reply, items: [...reply.items].reverse() } : reply;
    },
  }),
}));
vi.mock('../figures/live.js', async (original) => ({
  ...(await original<typeof import('../figures/live.js')>()),
  liveReply: async () => server.figures,
}));

const { livePmCalendar, refreshCalendar } = await import('./live.js');
const t = i18n.t.bind(i18n);

const figuresWith = (value: unknown, status = 'ready', ids: string[] = ['t1']) => ({
  asOf: TODAY,
  figures: [
    {
      key: 'pm-compliance',
      screen: 'pm-calendar',
      owner: 50,
      status,
      value,
      drill: { type: 'ticket', ids },
    },
  ],
});
const ask = (
  query: Parameters<typeof livePmCalendar>[1] = { range: null },
  client = new QueryClient(),
) => livePmCalendar(client, query, t as never);

beforeEach(() => {
  server.role = 'head';
  server.reads = 0;
  server.reversed = false;
  server.figures = figuresWith(COMPLIANCE);
});

describe('the live PM calendar reads what v1 read', () => {
  it('opens on the plant’s own month and then on the six weeks the grid asks for', async () => {
    const first = await ask();
    expect(first.range).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(first.today).toBe(TODAY);
    const grid = { from: '2026-10-26', to: '2026-12-06' };
    expect((await ask({ range: grid })).range).toEqual(grid);
  });

  it('lets only a head or an admin move a job, by the signed-in role and not by what the screen asks', async () => {
    const roles: [string, boolean][] = [
      ['head', true],
      ['admin', true],
      ['plant-head', false],
      ['supervisor', false],
    ];
    for (const [role, may] of roles) {
      server.role = role;
      expect((await ask({ range: null, canMove: !may })).canMove, role).toBe(may);
    }
  });

  it('says "not computed yet" for the figure, not zero, and still draws the calendar', async () => {
    server.figures = figuresWith(null, 'not_computed', []);
    const model = await ask();
    expect(model.drill).toBeNull();
    expect(model.judged).toEqual([]);
    expect(model.jobs.length).toBeGreaterThan(0);
  });

  it('offers the rows behind the figure as a page action only when the engine named rows', async () => {
    expect((await ask()).drill).toEqual({
      figure: 'pm-compliance',
      label: en['analytics.drill.open'],
    });
    server.figures = figuresWith(COMPLIANCE, 'ready', []);
    expect((await ask()).drill).toBeNull();
  });
});

/** Everything a reader can read or press: the model without the handles a write is addressed by. */
const readable = (model: PmCalendarModel): string =>
  JSON.stringify(model, (key, value) => (key === 'handle' ? undefined : value));

describe('the PM calendar on a plant whose ids are UUIDs, as the server sends', () => {
  it('prints machine codes and never an id, and addresses each write to its own job by the job’s own ids', async () => {
    const model = await ask({ range: { from: '2026-01-01', to: '2027-12-31' } });
    expect(model.jobs.length).toBeGreaterThan(50);
    expect(readable(model)).not.toMatch(UUID);
    const items = calendarFor({ from: '2026-01-01', to: '2027-12-31' }).items;
    for (const job of model.jobs) {
      const item = items.find((one) => one.machineCode === job.machine.label)!;
      expect(job.handle).toEqual({
        machineId: item.machineId,
        planId: item.planId,
        ticketId: item.ticketId,
      });
    }
  });

  it('pairs each job and its chip by the same occurrence even when the server sends them in another order', async () => {
    const range = { from: '2026-11-01', to: '2026-11-30' };
    const straight = await ask({ range });
    server.reversed = true;
    const reversed = await ask({ range }, new QueryClient());
    const handleOf = (model: PmCalendarModel, code: string) =>
      model.jobs.find((job) => job.machine.label === code)!.handle;
    expect(reversed.jobs.map((job) => job.machine.label).sort()).toEqual(
      straight.jobs.map((job) => job.machine.label).sort(),
    );
    for (const job of straight.jobs) {
      const code = job.machine.label;
      expect(handleOf(reversed, code)).toEqual(job.handle);
      expect(reversed.events.find((event) => event.code === code)?.id).toBe(
        reversed.jobs.find((one) => one.machine.label === code)?.id,
      );
    }
  });
});

describe('the calendar is read again every 30 seconds, as v1 read it', () => {
  it('serves a read under 30 seconds old from its copy, until the refresh marks it old', async () => {
    const client = keepOwners(new QueryClient());
    await ask({ range: null }, client);
    await ask({ range: null }, client);
    expect(server.reads).toBe(1);
    const again = vi.fn();
    refreshCalendar(client, again);
    expect(again).toHaveBeenCalledTimes(1);
    await ask({ range: null }, client);
    expect(server.reads).toBe(2);
  });
});

describe('the answer key is the real engine', () => {
  it('has a pm-compliance figure the real reply can hold, so the live adapter reads the engine’s own shape', () => {
    expect(realReply().figures.some((figure) => figure.key === 'pm-compliance')).toBe(true);
  });
});
