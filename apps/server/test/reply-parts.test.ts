import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  contributeTicketPart,
  ticketPartsAfterWrite,
  withTicketParts,
  type TicketPart,
} from '../src/kernel/index.js';

const client = {} as PoolClient;
const project = (row: Record<string, unknown>) => ({ id: row.id, a: 1 });
const rows = [{ id: 't1' }, { id: 't2' }];

function part(name: string, value: unknown, write: Record<string, unknown> = {}): TicketPart {
  return {
    name,
    load: async () => new Map([['t1', value]]),
    afterWrite: vi.fn(async () => write),
  };
}

describe('ticket reply parts', () => {
  it('merges each part under its name after the projection', async () => {
    contributeTicketPart(part('fake', 'x'));
    const out = await withTicketParts(client, 'tenant', rows, project);
    expect(out).toEqual([
      { id: 't1', a: 1, fake: 'x' },
      { id: 't2', a: 1, fake: null },
    ]);
    expect(Object.keys(out[0]!)).toEqual(['id', 'a', 'fake']);
  });

  it('keeps contribution order', async () => {
    contributeTicketPart(part('fake', 'x'));
    contributeTicketPart(part('fake2', 'y'));
    const out = await withTicketParts(client, 'tenant', rows, project);
    expect(Object.keys(out[0]!)).toEqual(['id', 'a', 'fake', 'fake2']);
  });

  it('returns the write fields of every part in order', async () => {
    const fake = part('fake', 'x', { b: 2, fake: 'y' });
    contributeTicketPart(fake);
    const write = { tenantId: 'tenant', ticketId: 't1', now: new Date(), command: 'raise' };
    const out = await ticketPartsAfterWrite(client, write);
    expect(out).toEqual({ b: 2, fake: 'y' });
    expect(fake.afterWrite).toHaveBeenCalledWith(client, write);
  });

  it('a part contributed twice under one name is replaced', async () => {
    contributeTicketPart(part('fake', 'first'));
    contributeTicketPart(part('fake', 'second'));
    const out = await withTicketParts(client, 'tenant', [{ id: 't1' }], project);
    expect(out[0]!.fake).toBe('second');
    expect(Object.keys(out[0]!).filter((k) => k === 'fake')).toHaveLength(1);
  });
});
