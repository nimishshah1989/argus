import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api.js';
import type { QueueEntry } from './outbox.js';
import { replayOutbox } from './replay.js';

const apiMocks = vi.hoisted(() => ({
  sendCommand: vi.fn(),
  isOffline: vi.fn(() => false),
}));

vi.mock('../api.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api.js')>();
  return { ...original, sendCommand: apiMocks.sendCommand, isOffline: apiMocks.isOffline };
});

const outboxMocks = vi.hoisted(() => ({
  listQueued: vi.fn(),
  removeQueued: vi.fn(),
  addDraft: vi.fn(),
}));

// The phone is acting as person-1; entries record who made them (review of PR 225).
const ME = { loginId: 'login-1', actingPersonId: 'person-1', name: 'Person 01' };
vi.mock('../data/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../data/index.js')>();
  return { ...original, currentWho: () => ME };
});

vi.mock('./outbox.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./outbox.js')>();
  return { ...original, ...outboxMocks };
});

function entry(id: string, action: QueueEntry['action'] = 'close', who = ME): QueueEntry {
  return {
    id,
    action,
    ticketId: `ticket-${id}`,
    ref: `BD-01${id}`,
    body: { personId: 'person-1', kind: 'no_report', note: 'done' } as QueueEntry['body'],
    idempotencyKey: `key-${id}`,
    at: '2026-11-10T09:30:00.000Z',
    createdAt: `2026-11-10T09:30:0${id}.000Z`,
    who,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.isOffline.mockReturnValue(false);
  outboxMocks.listQueued.mockResolvedValue([]);
  outboxMocks.removeQueued.mockResolvedValue(undefined);
  outboxMocks.addDraft.mockResolvedValue(undefined);
  apiMocks.sendCommand.mockResolvedValue({ ticket: {} });
});

describe('replayOutbox', () => {
  it('replays queued commands in order and drops each after success', async () => {
    outboxMocks.listQueued.mockResolvedValue([entry('1'), entry('2')]);

    const summary = await replayOutbox();

    expect(apiMocks.sendCommand.mock.calls.map((call) => call[0])).toEqual([
      'ticket-1',
      'ticket-2',
    ]);
    expect(outboxMocks.removeQueued.mock.calls.map((call) => call[0])).toEqual(['1', '2']);
    expect(summary).toEqual({ attempted: 2, replayed: 2, drafted: 0, kept: 0, held: 0 });
  });

  it('keeps the chosen close time in the replayed body', async () => {
    outboxMocks.listQueued.mockResolvedValue([entry('1')]);

    await replayOutbox();

    const body = apiMocks.sendCommand.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(body.at).toBe('2026-11-10T09:30:00.000Z');
    expect(apiMocks.sendCommand.mock.calls[0]?.[3]).toBe('key-1');
  });

  it('does not add a time to a late report body', async () => {
    outboxMocks.listQueued.mockResolvedValue([entry('1', 'report')]);

    await replayOutbox();

    const body = apiMocks.sendCommand.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(body.at).toBeUndefined();
  });

  it('moves a 409 to drafts and carries on', async () => {
    outboxMocks.listQueued.mockResolvedValue([entry('1'), entry('2')]);
    apiMocks.sendCommand
      .mockRejectedValueOnce(new ApiError('conflict', 'Ticket changed'))
      .mockResolvedValueOnce({ ticket: {} });

    const summary = await replayOutbox();

    expect(outboxMocks.addDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1' }),
      'Ticket changed',
    );
    expect(outboxMocks.removeQueued).toHaveBeenCalledWith('1');
    expect(outboxMocks.removeQueued).toHaveBeenCalledWith('2');
    expect(summary).toEqual({ attempted: 2, replayed: 1, drafted: 1, kept: 0, held: 0 });
  });

  it('a 403 forbidden moves that entry to drafts with a copy key and carries on', async () => {
    outboxMocks.listQueued.mockResolvedValue([entry('1'), entry('2')]);
    apiMocks.sendCommand
      .mockRejectedValueOnce(new ApiError('forbidden', 'Not allowed'))
      .mockResolvedValueOnce({ ticket: {} });

    const summary = await replayOutbox();

    expect(outboxMocks.addDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1' }),
      'Not allowed',
      'outbox.queuedForSomeoneElse',
    );
    expect(outboxMocks.removeQueued.mock.calls.map((call) => call[0])).toEqual(['1', '2']);
    expect(apiMocks.sendCommand).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({ attempted: 2, replayed: 1, drafted: 1, kept: 0, held: 0 });
  });

  it('stops on a network error and keeps the rest queued', async () => {
    outboxMocks.listQueued.mockResolvedValue([entry('1'), entry('2')]);
    apiMocks.sendCommand.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const summary = await replayOutbox();

    expect(apiMocks.sendCommand).toHaveBeenCalledTimes(1);
    expect(outboxMocks.removeQueued).not.toHaveBeenCalled();
    expect(outboxMocks.addDraft).not.toHaveBeenCalled();
    expect(summary).toEqual({ attempted: 1, replayed: 0, drafted: 0, kept: 2, held: 0 });
  });

  it('stops on a non-conflict server error rather than dropping the entry', async () => {
    outboxMocks.listQueued.mockResolvedValue([entry('1')]);
    apiMocks.sendCommand.mockRejectedValueOnce(new ApiError('validation', 'Invalid'));

    const summary = await replayOutbox();

    expect(outboxMocks.removeQueued).not.toHaveBeenCalled();
    expect(summary.kept).toBe(1);
  });

  it('holds what another login or person queued on this phone: never sent, never removed', async () => {
    const other = { loginId: 'login-2', actingPersonId: 'person-2', name: 'Person 02' };
    const legacy = { ...entry('3'), who: undefined };
    outboxMocks.listQueued.mockResolvedValue([entry('1', 'close', other), entry('2'), legacy]);

    const summary = await replayOutbox();

    expect(apiMocks.sendCommand.mock.calls.map((call) => call[0])).toEqual(['ticket-2']);
    expect(outboxMocks.removeQueued.mock.calls.map((call) => call[0])).toEqual(['2']);
    expect(summary).toEqual({ attempted: 1, replayed: 1, drafted: 0, kept: 0, held: 2 });
  });

  it('does nothing when offline', async () => {
    apiMocks.isOffline.mockReturnValue(true);
    outboxMocks.listQueued.mockResolvedValue([entry('1')]);

    const summary = await replayOutbox();

    expect(outboxMocks.listQueued).not.toHaveBeenCalled();
    expect(summary).toEqual({ attempted: 0, replayed: 0, drafted: 0, kept: 0, held: 0 });
  });
});

describe('isQueueable', () => {
  it('queues only close and report', async () => {
    const { isQueueable } = await import('./outbox.js');
    expect(isQueueable('close')).toBe(true);
    expect(isQueueable('report')).toBe(true);
    for (const action of [
      'start',
      'pause',
      'resume',
      'update',
      'transfer',
      'cancel',
      'join',
      'leave',
    ] as const) {
      expect(isQueueable(action)).toBe(false);
    }
  });
});
