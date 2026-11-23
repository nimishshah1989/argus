// @vitest-environment node
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { recordedBoard } from './test-board.js';

const FILE = new URL('./frozen-board.json', import.meta.url);

describe('the gallery’s recorded board', () => {
  it('is what the real engine says for the frozen 11 November plant (UPDATE_FROZEN=1 records it again)', () => {
    const said = recordedBoard();
    if (process.env.UPDATE_FROZEN) writeFileSync(FILE, `${JSON.stringify(said, null, 1)}\n`);
    expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(said);
  });
});
