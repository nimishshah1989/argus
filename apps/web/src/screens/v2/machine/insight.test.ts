// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Ticket } from '@uptimo/shared/replies';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';
import { realReply } from '../figures/real-reply.js';
import { realT } from '../printed-page/test-support.js';
import { machinePageModel } from './adapter.js';
import type { Translate } from '../figures/read.js';

/**
 * ADR 0031 §5: spares and tasks open with a takeaway; every tile's yardstick is the machine's plant rank.
 * Critical tests only (ADR 0034): figures and what is shown when data is missing, not wording or tone.
 */
const machines = ENGINE_DATA.machines.map((m) => ({
  id: m.id,
  code: m.code,
  category: m.category ?? null,
  cell: m.cell ?? null,
}));
const task = (over: Partial<Ticket>) =>
  ({
    id: 't1',
    ref: 'BD-1',
    problem: 'Spindle alarm',
    status: 'open',
    raisedChannel: 'floor',
    taskExpectedOn: null,
    reportedAt: '2026-11-10T08:00:00Z',
    ...over,
  }) as unknown as Ticket;
const modelWith = (tickets: Ticket[] | null) =>
  machinePageModel(
    realReply(),
    { param: 'HMC-2', machines, tickets, timeZone: 'Asia/Kolkata' },
    realT as unknown as Translate,
  )!;
// One open breakdown, one PM job overdue since 5 Nov.
const model = modelWith([
  task({}),
  task({
    id: 't2',
    ref: 'PM-1',
    problem: 'Greasing',
    raisedChannel: 'pm',
    taskExpectedOn: '2026-11-05',
  }),
]);

describe('Machine page insight pass (ticket 643)', () => {
  it('names the part with the most downtime as the spares outlier', () => {
    const part = 'Rectifier O/P 440V AC and I/P 190V DC';
    const line = model.takeaways?.['machine.spares'];
    expect(line?.outlier).toBe(part);
    for (const figure of [part, '4.0×', '(4.0)']) expect(line?.text ?? '').toContain(figure);
  });

  it('counts open and overdue tasks', () => {
    const text = model.takeaways?.['machine.tasks']?.text ?? '';
    for (const figure of ['2 open', '1 overdue']) expect(text).toContain(figure);
  });

  it('says the tasks could not be read, never a count, when the tickets are missing', () => {
    const unread = modelWith(null);
    expect(unread.takeaways?.['machine.tasks']?.text).toBe(unread.tasks.unavailable);
  });

  it("gives every tile the machine's rank in the plant as its yardstick", () => {
    const rank = (r: number, n: number) => `${r} of ${n} machines, highest first`;
    const any = expect.stringMatching(/^\d+ of \d+ machines, highest first$/);
    expect(model.kpis).toMatchObject([
      { id: 'age', yardstick: rank(4, 160) },
      { id: 'floor-area', yardstick: rank(16, 175) },
      { id: 'connected-load', yardstick: rank(15, 142) },
      { id: 'running-load', yardstick: any },
      { id: 'breakdowns', yardstick: rank(1, 125) },
      { id: 'breakdown-hours', yardstick: rank(6, 125) },
      { id: 'mttr', yardstick: rank(30, 117) },
      { id: 'pm-hours', yardstick: rank(51, 125) },
    ]);
  });
});
