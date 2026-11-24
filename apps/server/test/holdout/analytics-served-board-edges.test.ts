import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { actionCenterBoardSchema } from '@uptimo/shared';
import { resetEngineRunsInRead } from '../../src/modules/analytics/served.js';
import {
  boardsBuilt,
  resetServedBoards,
  SERVED_BOARD_LIMIT,
} from '../../src/modules/analytics/served-board.js';
import { startFixture, type Fixture } from '../plant-settings-fixture.js';

// Ticket 628 hidden edges for the held board: plants never share a board, each date is its own board, the asked
// date is the board's date, and the held boards stay bounded.

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
}, 180_000);
afterAll(async () => f.stop());
beforeEach(() => {
  resetEngineRunsInRead();
  resetServedBoards();
});

const read = (asOf: string, token: string) =>
  f.call('GET', `/api/v1/analytics/action-center?asOf=${asOf}`, token);

describe('held boards (628 edges)', () => {
  it('never answers one plant with the board of another', async () => {
    const a = await read('2026-11-10', f.tokens.head!);
    const b = await read('2026-11-10', f.tokens['b-admin']!);
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(boardsBuilt()).toBe(2);
  });

  it('builds one board per date, each carrying the asked date, and still parses against the contract', async () => {
    for (const day of ['2026-11-10', '2026-11-11', '2026-11-10', '2026-11-11']) {
      const res = await read(day, f.tokens.head!);
      expect(res.statusCode).toBe(200);
      expect(actionCenterBoardSchema.parse(res.json()).asOf).toBe(day);
    }
    expect(boardsBuilt()).toBe(2);
  });

  it('drops the least recently used board past the limit', async () => {
    const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    for (let i = 0; i <= SERVED_BOARD_LIMIT; i += 1) await read(day(i), f.tokens.head!);
    expect(boardsBuilt()).toBe(SERVED_BOARD_LIMIT + 1);
    await read(day(SERVED_BOARD_LIMIT), f.tokens.head!);
    expect(boardsBuilt()).toBe(SERVED_BOARD_LIMIT + 1);
    await read(day(0), f.tokens.head!);
    expect(boardsBuilt()).toBe(SERVED_BOARD_LIMIT + 2);
  });
});
