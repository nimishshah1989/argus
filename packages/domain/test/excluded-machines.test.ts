import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { run, type EngineData, type EngineResult } from '../src/index.js';
import { AS_OF, LEFT_OUT, plant } from './excluded-fixture.js';

/**
 * Ticket 77a: a machine the plant leaves out of production data. Ten invented machines, five of them left out; every
 * expected number below is worked by hand in `excluded-fixture.ts` (1,500 available hours a machine; counted
 * breakdowns 4 and 70 hours; left-out breakdowns 4 and 150 hours; PM 5 hours counted and 10 left out).
 */

const figure = (result: EngineResult, key: string) => {
  const found = result.figures.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`no figure ${key}`);
  return found;
};

const runOf = (data: EngineData): EngineResult => run(data, AS_OF, DEFAULT_PROFILE);

interface Page {
  pages: {
    kpis: { label: string; value: string }[];
    tables: { title: string; rows: string[][] }[];
  }[];
}
const page = (result: EngineResult, key: string): Page['pages'][number] =>
  (figure(result, key).value as unknown as Page).pages[0]!;
const kpi = (result: EngineResult, key: string, label: string) =>
  page(result, key).kpis.find((entry) => entry.label === label)?.value;
const row = (result: EngineResult, key: string, title: string) =>
  page(result, key).tables.find((table) => table.title === title)!.rows[0];

/** The same plant with the left-out machines and everything they recorded removed: what a counted plant would be. */
function withoutLeftOut(data: EngineData): EngineData {
  const gone = new Set<string>(LEFT_OUT);
  return {
    ...data,
    machines: data.machines.filter((machine) => !gone.has(machine.id)),
    reports: data.reports.filter((entry) => !gone.has(entry.machineId)),
    tickets: data.tickets.filter((entry) => !gone.has(entry.machineId ?? '')),
    settings: { ...data.settings!, excludedMachineIds: [] },
  };
}

describe('machines the plant leaves out of production data', () => {
  for (const how of ['settings', 'both'] as const) {
    describe(`named in ${how === 'settings' ? 'the settings list only' : 'the settings and on their rows'}`, () => {
      const left = runOf(plant(how));

      it('counts their breakdowns in 0 of BD %, MTTR, MTBF and availability', () => {
        expect(figure(left, 'dashboard.plant-bd-pct').value).toBe(0.93);
        expect(figure(left, 'dashboard.fleet-availability').value).toBe(99);
        expect(figure(left, 'dashboard.total-breakdowns').value).toBe(4);
        expect(kpi(left, 'a1-bd-pm', 'Total Machines')).toBe('5');
        expect(kpi(left, 'a1-bd-pm', 'Actual Breakdown')).toBe('70.0 hrs');
        expect(kpi(left, 'a1-bd-pm', 'Fleet Availability')).toBe('99.00%');
        expect(row(left, 'a3-mttr-mtbf', 'By Category')).toEqual([
          'Turning Center',
          '5',
          '4',
          '70.00',
          '17.50',
          '1,857.50',
        ]);
      });

      it('equals the plant that never had those machines, for each of the four', () => {
        const never = runOf(withoutLeftOut(plant('none')));
        for (const key of [
          'dashboard.plant-bd-pct',
          'dashboard.fleet-availability',
          'a1-bd-pm',
          'a3-mttr-mtbf',
        ]) {
          expect(figure(left, key).value, key).toEqual(figure(never, key).value);
        }
      });

      it('still counts their breakdowns in the manpower hours and the energy list: 2 of 2', () => {
        const counted = runOf(plant('none'));
        expect(kpi(left, 'a4-manpower', 'Total Breakdowns')).toBe('8');
        expect(kpi(left, 'a4-manpower', 'Total BD Hours')).toBe('220.0');
        expect(page(left, 'a4-manpower').tables[0]!.rows.map((entry) => entry.slice(0, 4))).toEqual(
          [
            ['Person P-A', 'Team', '4', '90.00'],
            ['Person P-B', 'Team', '4', '130.00'],
          ],
        );
        expect(figure(left, 'a4-manpower').value).toEqual(figure(counted, 'a4-manpower').value);
        expect(figure(left, 'a4-manpower').drill.ids).toHaveLength(8);
        const energy = figure(left, 'a5-energy');
        expect(energy.value).toEqual(figure(counted, 'a5-energy').value);
        expect(energy.drill.ids).toHaveLength(10);
        const [cell] = (energy.value as unknown as { extra: { byCell: Record<string, unknown>[] } })
          .extra.byCell;
        expect(cell).toMatchObject({ machines: 10, totalKva: 100, runningKva: 20 });
      });

      it('says how many machines are left out', () => {
        expect(left.excludedMachines).toBe(5);
        expect(runOf(plant('none')).excludedMachines).toBe(0);
      });
    });
  }

  it('with none left out, the same plant counts all ten in BD %, MTTR and availability', () => {
    const counted = runOf(plant('none'));
    expect(figure(counted, 'dashboard.plant-bd-pct').value).toBe(1.47);
    expect(figure(counted, 'dashboard.fleet-availability').value).toBe(98.43);
    expect(row(counted, 'a3-mttr-mtbf', 'By Category')).toEqual([
      'Turning Center',
      '10',
      '8',
      '220.00',
      '27.50',
      '1,847.50',
    ]);
  });

  it('names an id that is no machine of the plant without counting it', () => {
    const data = plant('settings');
    const stray = {
      ...data,
      settings: { ...data.settings!, excludedMachineIds: [...LEFT_OUT, 'Z-9'] },
    };
    expect(runOf(stray).excludedMachines).toBe(5);
  });
});
