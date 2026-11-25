// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { dropEmptyColumns, mostlyEmpty } from '../heat-rules.js';

describe('Heat grid rules: edges', () => {
  it('a column holding a 0 is not empty', () => {
    expect(
      dropEmptyColumns(
        ['Jan', 'Feb'],
        [
          [0, null],
          [null, null],
        ],
      ),
    ).toEqual({ columns: ['Jan'], rows: [[0], [null]] });
  });

  it('all columns empty leaves no columns', () => {
    expect(
      dropEmptyColumns(
        ['Jan', 'Feb'],
        [
          [null, undefined],
          [undefined, null],
        ],
      ),
    ).toEqual({
      columns: [],
      rows: [[], []],
    });
  });

  it('exactly half empty is not mostly empty; 0 is not empty', () => {
    expect(
      mostlyEmpty([
        [1, null],
        [null, 2],
      ]),
    ).toBe(false);
    expect(mostlyEmpty([[0, 0, null]])).toBe(false);
    expect(mostlyEmpty([[null, undefined, 0]])).toBe(true);
  });
});
