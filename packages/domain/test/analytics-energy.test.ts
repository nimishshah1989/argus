import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  COMPUTERS,
  runWith,
  type Computed,
  type EngineData,
  type FigureResult,
  type MachineRow,
} from '../src/index.js';
import { A5, type EnergyBucket, type EnergyKey } from './answer-key/keys.js';
import { ENGINE_DATA } from './answer-key/fixture.js';

/**
 * The A5 energy heatmap (packet 41b): the platform's whole figure against the frozen 11 November key — the empty
 * page beside its two heat grids and the plant's efficiency factor, raw floats and no tolerance. A5 is the one
 * analytics figure that reads every CNC machine, the excluded ones included: the key's cell 1 lists BOXY.
 */

const AS_OF = '2026-11-11';

/** Every CNC machine, in data order: the A5 fleet, excluded-from-production included. */
const CNC: readonly MachineRow[] = ENGINE_DATA.machines.filter(
  (machine) => machine.segment === 'CNC',
);

function compute(data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === 'a5-energy');
  if (!found) throw new Error('the engine knows no figure a5-energy');
  return found;
}

/** The computer itself, so the drill's own order (before the engine sorts and dedupes it) is observable. */
function runComputer(data: EngineData = ENGINE_DATA): Computed {
  const figure = COMPUTERS['a5-energy'];
  if (figure === undefined) throw new Error('the engine knows no figure a5-energy');
  return figure({ data, asOf: AS_OF, profile: DEFAULT_PROFILE });
}

function valueOf(data: EngineData = ENGINE_DATA): EnergyKey {
  const value = runComputer(data).value;
  if (value === null) throw new Error('the A5 figure printed no value');
  return value as unknown as EnergyKey;
}

/** One heat-grid bucket by its key; a key the grid does not hold is a test bug, so it throws. */
function bucket(value: EnergyKey, grid: 'byCell' | 'byLocation', key: string): EnergyBucket {
  const found = value.extra[grid].find((candidate) => candidate.key === key);
  if (!found) throw new Error(`the A5 ${grid} grid holds no bucket "${key}"`);
  return found;
}

/** The rated power the figure reads: a finite number, else nothing. */
const powerOf = (machine: MachineRow): number =>
  machine.powerKw !== null && Number.isFinite(machine.powerKw) ? machine.powerKw : 0;

describe('the A5 energy heatmap', () => {
  it("equals the key's whole figure: the page, both grids and the efficiency factor", () => {
    const computed = compute();
    // Red first: the A5 computer had not landed, so the engine answered not_computed.
    expect(computed.status).toBe('ready');
    expect(computed.value).toEqual(A5);
  });

  it('drills every CNC machine in data order, the excluded ones included', () => {
    expect(CNC.length).toBeGreaterThan(0);
    // The computer names the fleet in the plant's own order; the engine then dedupes and sorts it.
    expect(runComputer().drillIds).toEqual(CNC.map((machine) => machine.id));
    const computed = compute();
    expect(computed.drill.type).toBe('machine');
    expect(computed.drill.ids).toEqual([...CNC.map((machine) => machine.id)].sort());
    const known = new Set(ENGINE_DATA.machines.map((machine) => machine.id));
    expect(computed.drill.ids.every((id) => known.has(id))).toBe(true);
    // The excluded BOXY is in cell 1 of the key, so excluding production data cannot shrink this fleet.
    expect(bucket(A5, 'byCell', '1').machineIds).toContain('BOXY');
    const excluded = CNC.filter((machine) => machine.excludedFromProduction);
    expect(excluded.length).toBeGreaterThan(0);
    for (const machine of excluded) expect(computed.drill.ids).toContain(machine.id);
  });

  it('reads a machine its own efficiency: connected load untouched, running load up by power × the difference', () => {
    // The 11 Nov rule the committed discovery export lacks: a machine may carry its own efficiency beside the
    // plant's factor, and running load is summed per machine. The committed workbook carries none (blank on every
    // row), so the key's running load is the plant's 20% throughout; the rule still has to bite when one does.
    const machine = CNC.find((candidate) => powerOf(candidate) > 0);
    if (machine === undefined) throw new Error('the fixture has no CNC machine with a rated power');
    const grown: EngineData = {
      ...ENGINE_DATA,
      machines: ENGINE_DATA.machines.map((candidate) =>
        candidate.id === machine.id
          ? { ...candidate, metadata: { ...candidate.metadata, efficiency: 50 } }
          : candidate,
      ),
    };
    const before = valueOf();
    const after = valueOf(grown);
    const cell = machine.cell?.trim() ?? '';
    const beforeBucket = bucket(before, 'byCell', cell);
    const afterBucket = bucket(after, 'byCell', cell);
    expect(afterBucket.totalKva).toBe(beforeBucket.totalKva);
    expect(afterBucket.runningKva).toBe(
      beforeBucket.runningKva + powerOf(machine) * (0.5 - DEFAULT_PROFILE.efficiencyFactor / 100),
    );
  });

  it('adds a last "—" bucket for a blank cell, and the machine keeps its location bucket', () => {
    const machine = CNC.find((candidate) => (candidate.cell ?? '').trim() !== '');
    if (machine === undefined) throw new Error('the fixture has no CNC machine with a cell');
    const location = machine.location;
    if (location === null) throw new Error('the fixture machine has no location to check');
    const grown: EngineData = {
      ...ENGINE_DATA,
      machines: ENGINE_DATA.machines.map((candidate) =>
        candidate.id === machine.id ? { ...candidate, cell: '' } : candidate,
      ),
    };
    const value = valueOf(grown);
    const cells = value.extra.byCell;
    const last = cells.at(-1);
    if (last === undefined) throw new Error('the A5 byCell grid is empty');
    // No cell is unknown on the key, so the dash bucket appears only because this machine's cell is blank.
    expect(value.extra.byCell).toHaveLength(A5.extra.byCell.length + 1);
    expect(last.key).toBe('—');
    expect(last.machineIds).toEqual([machine.id]);
    expect(cells.slice(0, -1).flatMap((group) => group.machineIds)).not.toContain(machine.id);
    // A blank cell is still a located machine: the two grids are independent readings of the same fleet.
    expect(bucket(value, 'byLocation', location).machineIds).toContain(machine.id);
    expect(cells.reduce((total, group) => total + group.machines, 0)).toBe(CNC.length);
  });

  it('prints no figure for a plant with no CNC machine', () => {
    const computed = compute({
      ...ENGINE_DATA,
      machines: ENGINE_DATA.machines.filter((machine) => machine.segment !== 'CNC'),
    });
    expect(computed.status).toBe('ready');
    expect(computed.value).toBeNull();
    expect(computed.drill.ids).toEqual([]);
  });
});
