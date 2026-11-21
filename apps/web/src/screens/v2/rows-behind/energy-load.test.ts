// @vitest-environment node
import { DEFAULT_PROFILE } from '@uptimo/shared';
import type { DrillReply } from '@uptimo/shared/analytics';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith } from '../../../../../../packages/domain/src/index.js';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';
import { adapterWords } from '../../../gallery/rows-behind/words.js';
import { loadBasis } from './tile.js';
import { rowsBehindModel } from '../../../ui/v2/domain/rows-behind-adapter.js';

type Bucket = {
  key: string;
  machines: number;
  totalKva: number;
  runningKva: number;
  machineIds: string[];
};
type Extra = { byCell: Bucket[]; effFactorPct: number };

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const result = runWith({ 'a5-energy': COMPUTERS['a5-energy']! } as never, {
  data: ENGINE_DATA,
  asOf: '2026-11-11',
  profile: DEFAULT_PROFILE,
});
const { byCell, effFactorPct } = (
  result.figures.find((f) => f.key === 'a5-energy')!.value as { extra: Extra }
).extra;

/** The machines of a tile as the drill reply sends them: a database id that is not the code, and the nameplate load. */
function drillOf(tile: Bucket): DrillReply {
  const rows = tile.machineIds.map((machineId, at) => {
    const machine = ENGINE_DATA.machines.find((m) => m.id === machineId)!;
    return {
      ...machine,
      id: `00000000-0000-4000-8000-${String(at).padStart(12, '0')}`,
      status: 'active' as const,
    };
  });
  return { type: 'machine', rows } as unknown as DrillReply;
}

const rowsOf = (tile: Bucket, load = true) =>
  rowsBehindModel({
    figure: { key: 'a5-energy', label: 'Energy', value: '' },
    reply: drillOf(tile),
    asOf: '2026-11-11',
    machineCode: () => undefined,
    words: adapterWords,
    ...(load ? { load: loadBasis(effFactorPct) } : {}),
  })!;

describe('the machines behind an energy tile print their connected and running load', () => {
  it('adds up, machine by machine, to the tile’s own connected and running load', () => {
    const tiles = byCell.filter((tile) => tile.machines > 0);
    expect(tiles.length).toBeGreaterThan(3);
    for (const tile of tiles) {
      const model = rowsOf(tile);
      const sum = (key: string) =>
        model.rows.reduce((total, row) => total + Number(row.cells[key]?.sort ?? 0), 0);
      expect(model.rows, `cell ${tile.key}`).toHaveLength(tile.machines);
      expect(sum('connectedKva')).toBeCloseTo(tile.totalKva, 6);
      // Each machine's running load is printed to 2 decimals, so the sum is within half a hundredth a machine.
      expect(Math.abs(sum('runningKva') - tile.runningKva)).toBeLessThanOrEqual(
        0.005 * tile.machines,
      );
    }
  });

  it('puts the two figures beside the machine and its cell, each sortable as a number', () => {
    const model = rowsOf(byCell.find((tile) => tile.machines > 0)!);
    expect(model.columns.map((c) => c.key).slice(0, 4)).toEqual([
      'machine',
      'cell',
      'connectedKva',
      'runningKva',
    ]);
    const [connected, running] = model.columns.slice(2, 4);
    expect([connected!.label, running!.label]).toEqual(['Connected KVA', 'Running KVA']);
    expect([connected!.numeric, connected!.sortable, running!.numeric]).toEqual([true, true, true]);
    for (const row of model.rows)
      expect(row.cells.connectedKva?.text).toMatch(/^(\d[\d,]*\.\d|—)$/);
  });

  it('runs a machine at its own efficiency when it has one (clamped to 100), and an unrated machine prints a dash', () => {
    const tile = byCell.find((t) => t.machines > 0)!;
    const [rated] = (drillOf(tile) as unknown as { rows: { powerKw: number | null }[] }).rows;
    const read = (row: object) =>
      rowsBehindModel({
        figure: { key: 'a5-energy', label: 'Energy', value: '' },
        reply: { type: 'machine', rows: [row] } as unknown as DrillReply,
        asOf: '2026-11-11',
        machineCode: () => undefined,
        words: adapterWords,
        load: loadBasis(effFactorPct),
      })!.rows[0]!.cells;
    const power = rated!.powerKw ?? 0;
    expect(power).toBeGreaterThan(0);
    expect(read({ ...rated, metadata: { efficiency: 50 } }).runningKva?.sort).toBeCloseTo(
      power / 2,
      1,
    );
    expect(read({ ...rated, metadata: { efficiency: 130 } }).runningKva?.sort).toBeCloseTo(
      power,
      1,
    );
    expect(read({ ...rated, metadata: {} }).runningKva?.sort).toBeCloseTo(
      (power * effFactorPct) / 100,
      1,
    );
    // A blank efficiency ('' or spaces, as every machine in the 11 Nov export has it) is none: the plant factor applies.
    for (const blank of ['', '  ', null])
      expect(read({ ...rated, metadata: { efficiency: blank } }).runningKva?.sort).toBeCloseTo(
        (power * effFactorPct) / 100,
        1,
      );
    expect(read({ ...rated, metadata: { efficiency: '50' } }).runningKva?.sort).toBeCloseTo(
      power / 2,
      1,
    );
    const unrated = read({ ...rated, powerKw: null });
    expect([unrated.connectedKva?.text, unrated.runningKva?.text]).toEqual(['—', '—']);
  });

  it('never prints a database id, and leaves the load columns off every other figure', () => {
    const tile = byCell.find((t) => t.machines > 0)!;
    const printed = rowsOf(tile).rows.flatMap((row) => Object.values(row.cells).map((c) => c.text));
    expect(printed.some((text) => UUID.test(text))).toBe(false);
    expect(rowsOf(tile, false).columns.map((c) => c.key)).not.toContain('connectedKva');
  });
});
