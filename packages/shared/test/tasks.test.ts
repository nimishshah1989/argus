import { describe, expect, it } from 'vitest';
import { pendingTasksOn, summariseTasks, taskInputSchema, taskState } from '../src/tasks.js';

describe('the state of a follow-up task', () => {
  const today = '2026-11-14';
  it.each([
    ['open', null, 'pending'],
    ['open', '2026-11-14', 'pending'],
    ['open', '2026-11-13', 'overdue'],
    ['working', '2026-11-20', 'in_progress'],
    ['waiting', null, 'in_progress'],
    ['working', '2026-11-01', 'overdue'],
    ['closed', '2026-11-01', 'done'],
  ])('%s with date %s is %s', (status, taskExpectedOn, expected) => {
    expect(taskState({ status, taskExpectedOn }, today)).toBe(expected);
  });
});

describe('the box on the parent', () => {
  it.each([
    [[], 'none'],
    [['done', 'done'], 'done'],
    [['done', 'pending'], 'pending'],
    [['in_progress', 'pending'], 'pending'],
    [['in_progress', 'in_progress', 'done'], 'in_progress'],
    [['overdue', 'in_progress'], 'overdue'],
  ] as const)('%j reads %s', (states, box) => {
    expect(summariseTasks(states).box).toBe(box);
  });

  it('the four counts add up to the tasks listed', () => {
    const summary = summariseTasks(['pending', 'in_progress', 'overdue', 'done', 'done']);
    expect(summary).toMatchObject({ pending: 1, inProgress: 1, overdue: 1, done: 2 });
  });
});

describe('a task left at close', () => {
  const ok = { text: 'Replace bearing', reasonCode: 'spare' };
  it('needs words and a reason; the date is optional but must be a real day', () => {
    expect(taskInputSchema.safeParse(ok).success).toBe(true);
    expect(taskInputSchema.safeParse({ ...ok, expectedOn: '2026-11-20' }).success).toBe(true);
    expect(taskInputSchema.safeParse({ ...ok, text: '  ' }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...ok, reasonCode: '' }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...ok, expectedOn: '2026-13-01' }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...ok, expectedOn: '20 Nov' }).success).toBe(false);
  });
});

describe('the pending tasks on a machine', () => {
  const task = (over: object) => ({
    parentId: 'p1',
    status: 'open',
    machineSnapshot: { id: 'm1' },
    ...over,
  });
  it('are the open child tickets that name the machine, and nothing else', () => {
    const open = [
      task({}),
      task({ status: 'working' }),
      task({ machineSnapshot: { id: 'm2' } }),
      task({ parentId: null }),
      task({ machineSnapshot: null }),
      task({ status: 'closed' }),
    ];
    expect(pendingTasksOn(open, 'm1')).toHaveLength(2);
  });
});
