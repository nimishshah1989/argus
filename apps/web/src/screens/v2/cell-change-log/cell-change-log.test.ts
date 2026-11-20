// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { fill } from '../../../i18n/fill.js';
import { cellMoves } from '../../analytics/machine-values.js';
import { printed, realReply, UUID } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { cellLogModel } from './adapter.js';

const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const real = realReply();
const engineMoves = cellMoves(real.figures.find((f) => f.key === 'cell-change-log')?.value);

/** The same moves as the server sends them: a database id for each machine, named by the plant's list. */
const ids = new Map(
  [...new Set(engineMoves.map((m) => m.machineId))].map((code, i) => [
    code,
    `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  ]),
);
const codes = new Map([...ids].map(([code, id]) => [id, code]));
const served: FiguresReply = {
  ...real,
  figures: real.figures.map((f) =>
    f.key === 'cell-change-log'
      ? {
          ...f,
          value: { moves: engineMoves.map((m) => ({ ...m, machineId: ids.get(m.machineId) })) },
        }
      : f,
  ),
};
const reader = (role: string | undefined) => ({
  codeOf: (id: string) => codes.get(id) ?? null,
  role,
  today: '2026-11-11',
});

describe('the cell change log, from the engine’s own reply', () => {
  it('has one row for every move, newest first, the machine by its code and never its database id', () => {
    const model = cellLogModel(served, t, reader('head'))!;
    expect(engineMoves.length).toBeGreaterThan(10);
    expect(model.table.rows).toHaveLength(engineMoves.length);
    expect(model.table.rows[0]?.[1]?.chip).toMatchObject({
      kind: 'machine',
      id: engineMoves[0]!.machineId,
    });
    expect(printed({ ...model, moves: [] }).some((text) => UUID.test(text))).toBe(false);
    const days = model.table.rows.map((row) => String(row[0]?.sort));
    expect([...days].sort().reverse()).toEqual(days);
  });

  it('writes each date as DD-MMM-YYYY and each cell change with a chip for the cell it left and the one it reached', () => {
    const model = cellLogModel(served, t, reader('head'))!;
    const first = model.table.rows[0]!;
    expect(first[0]?.text).toMatch(/^\d{2}-[A-Z][a-z]{2}-\d{4}$/);
    expect(first[2]?.chips).toHaveLength(2);
    expect(first[2]?.text).toBe(`${engineMoves[0]!.fromCell} → ${engineMoves[0]!.toCell}`);
  });

  it('says "No change" for a location that did not change', () => {
    const model = cellLogModel(served, t, reader('head'))!;
    const unchanged = engineMoves.findIndex(
      (m) => m.fromLocation !== null && m.fromLocation === m.toLocation,
    );
    expect(
      unchanged,
      'the answer key holds a move whose location did not change',
    ).toBeGreaterThanOrEqual(0);
    expect(model.table.rows[unchanged]?.[3]?.text).toBe('No change');
    expect(model.table.rows.every((row) => row[3]?.text !== '')).toBe(true);
  });

  it('offers the correction to a head and an admin and to no one else', () => {
    for (const [role, may] of [
      ['head', true],
      ['admin', true],
      ['plant_head', false],
      ['op', false],
      [undefined, false],
    ] as const) {
      const model = cellLogModel(served, t, reader(role))!;
      expect(model.canCorrect, String(role)).toBe(may);
      expect(
        model.table.rows[0]?.some((cell) => cell.action),
        String(role),
      ).toBe(may);
    }
  });

  it('words the saved-copy notice with the day the figures are for, before and after a correction', () => {
    const { words } = cellLogModel(served, t, reader('head'))!;
    expect(words.savedCopy).toContain('11-Nov-2026');
    expect(words.savedAfterCorrection).toContain('11-Nov-2026');
    expect(words.savedAfterCorrection).toMatch(/earlier date/);
  });

  it('hands the correction the day the move stands at, as the date field reads it', () => {
    const model = cellLogModel(served, t, reader('head'))!;
    expect(model.moves[0]).toMatchObject({ id: engineMoves[0]!.id, day: engineMoves[0]!.date });
  });

  it('exports the controlled document with its number above the table and one line per move', () => {
    const { csv } = cellLogModel(served, t, reader('head'))!;
    expect(csv.fileName).toBe('cell-change-log-2026-11-11.csv');
    expect(csv.text.split('\n')[0]).toBe('DOC. NO. CE-MTN-F-01');
    expect(csv.text.trim().split('\n')).toHaveLength(engineMoves.length + 4);
    expect(csv.text).toContain(engineMoves[0]!.machineId);
  });

  it('says there is no move yet when the log is empty, and that the engine has not computed it otherwise', () => {
    const empty: FiguresReply = {
      ...real,
      figures: real.figures.map((f) =>
        f.key === 'cell-change-log' ? { ...f, value: { moves: [] } } : f,
      ),
    };
    expect(cellLogModel(empty, t, reader('head'))?.moves).toEqual([]);
    const notReady: FiguresReply = {
      ...real,
      figures: real.figures.map((f) =>
        f.key === 'cell-change-log' ? { ...f, status: 'not_computed' as const, value: null } : f,
      ),
    };
    expect(cellLogModel(notReady, t, reader('head'))).toBeNull();
  });
});

/** Moves written the way v1's printed-data check had them (`CNC-01` stays put in its location, `DRL-04` came from nowhere). */
const logWith = (moves: Record<string, unknown>[]): FiguresReply => ({
  ...real,
  figures: real.figures.map((f) => (f.key === 'cell-change-log' ? { ...f, value: { moves } } : f)),
});
const M1 = '10000000-0000-4000-8000-0000000000a1';
const M3 = '10000000-0000-4000-8000-0000000000a3';
const listed = (id: string) => ({ [M1]: 'CNC-01', [M3]: 'DRL-04' })[id] ?? null;
const V1_MOVES = [
  {
    id: 'mv1',
    machineId: M1,
    date: '2026-02-10',
    fromCell: '2',
    toCell: '6',
    fromLocation: '434',
    toLocation: '434',
  },
  {
    id: 'mv2',
    machineId: M3,
    date: '2026-01-05',
    fromCell: null,
    toCell: '2',
    fromLocation: null,
    toLocation: 'Bay B',
  },
];
const asHead = { codeOf: listed, role: 'head', today: '2026-11-11' };

describe('what v1 printed for the log, kept', () => {
  it('prints a missing cell or location as a dash, a location that did not change as "No change", and each machine by its code', () => {
    const model = cellLogModel(logWith(V1_MOVES), t, asHead)!;
    const rows = model.table.rows.map((row) => row.map((cell) => cell.text));
    expect(rows).toEqual([
      ['10-Feb-2026', 'CNC-01', '2 → 6', 'No change', 'Correct date'],
      ['05-Jan-2026', 'DRL-04', '— → Cell 2', '— → Bay B', 'Correct date'],
    ]);
    expect(model.table.rows.map((row) => row[1]?.chip?.label)).toEqual(['CNC-01', 'DRL-04']);
  });

  it('shows a dash with no chip, and never a database id, for a machine the plant no longer lists', () => {
    const gone = '10000000-0000-4000-8000-0000000000ff';
    const model = cellLogModel(logWith([{ ...V1_MOVES[0], machineId: gone }]), t, asHead)!;
    expect(model.table.rows[0]?.[1]).toMatchObject({ text: '—' });
    expect(model.table.rows[0]?.[1]?.chip).toBeUndefined();
    expect(model.moves[0]?.code).toBe('—');
    // The move still carries its machine id so a head can correct it; it is never printed.
    expect(model.moves[0]?.machineId).toBe(gone);
    expect(printed({ ...model, moves: [], csv: undefined }).some((text) => UUID.test(text))).toBe(
      false,
    );
  });
});
