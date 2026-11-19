import { FC_PRIOR_DAYS } from './a9-forecast-sim.js';
import { dayNumber } from './plant-date.js';
import type { LabMachine, MethodKey } from './forecast-lab-sim.js';
import type { MachineRow } from './types.js';

/**
 * The Forecast Lab's four rates (ticket 42, packet 42d): each method's per-machine daily rate at a cut, split from
 * `forecast-lab-sim.ts` only for the 400-line budget. The exposure, the age-band fit and the rate are unchanged.
 */

const IPF_ROUNDS = 40;
const IPF_PRIOR = 4;
const bandOf = (age: number): number =>
  age < 3 ? 0 : age < 6 ? 1 : age < 10 ? 2 : age < 15 ? 3 : age < 999 ? 4 : -1;
const purchaseDay = (machine: MachineRow): number | null =>
  machine.purchasedOn === null ? null : dayNumber(machine.purchasedOn.slice(0, 10));
const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

type Exposure = { nw: number; Tw: number; rho: number };

type BandRow = { cat: string; yrs: number; n: number; band: number };

type BandFit = { c: Map<string, number>; a: number[]; r0: number };

/** A machine's exposure under the method: raw, or recent entries faded with the half-life. */
function exposureOf(machine: LabMachine, cut: number, halfLife: number, recent: boolean): Exposure {
  if (!recent) return { nw: machine.n, Tw: machine.t, rho: 1 };
  const nw = machine.episodes.reduce(
    (total, episode) => total + 0.5 ** (Math.max(0, cut - episode.last) / halfLife),
    0,
  );
  const Tw = (halfLife / Math.LN2) * (1 - 0.5 ** (machine.t / halfLife));
  return { nw, Tw, rho: Tw / machine.t };
}

/** The age band at the cut, or -1 for an unknown or not-yet-positive age. */
function ageBand(machine: LabMachine, cut: number): number {
  const bought = purchaseDay(machine.machine);
  if (bought === null) return -1;
  const age = (cut - bought) / 365.25;
  if (!(age >= 0)) return -1;
  return bandOf(age);
}

const bandWeight = (band: number, a: readonly number[]): number => (band < 0 ? 1 : (a[band] ?? 1));

const categoryLevel = (list: readonly BandRow[], a: readonly number[], r0: number): number =>
  (sum(list.map((row) => row.n)) + IPF_PRIOR) /
  (sum(list.map((row) => row.yrs * bandWeight(row.band, a))) + IPF_PRIOR / r0);

const bandLevel = (list: readonly BandRow[], c: ReadonlyMap<string, number>, r0: number): number =>
  list.length === 0
    ? 1
    : (sum(list.map((row) => row.n)) + IPF_PRIOR) /
      (sum(list.map((row) => row.yrs * (c.get(row.cat) ?? r0))) + IPF_PRIOR);

/** The multiplicative category × band fit, 40 rounds, pseudo-count 4, mean-normalised each pass. */
function fitBands(rows: readonly BandRow[]): BandFit {
  const used = rows.filter((row) => row.yrs > 0);
  const total = sum(used.map((row) => row.n));
  const years = sum(used.map((row) => row.yrs)) || 1;
  const r0 = total / years || 1e-9;
  const categories = [...new Set(used.map((row) => row.cat))];
  const c = new Map(categories.map((category) => [category, r0]));
  const a = [1, 1, 1, 1, 1];
  for (let round = 0; round < IPF_ROUNDS; round += 1) {
    for (const category of categories) {
      c.set(
        category,
        categoryLevel(
          used.filter((row) => row.cat === category),
          a,
          r0,
        ),
      );
    }
    for (let band = 0; band < a.length; band += 1) {
      a[band] = bandLevel(
        used.filter((row) => row.band === band),
        c,
        r0,
      );
    }
    const banded = used.filter((row) => row.band >= 0);
    const weight = sum(banded.map((row) => row.yrs)) || 1;
    const average = sum(banded.map((row) => row.yrs * bandWeight(row.band, a))) / weight || 1;
    for (let band = 0; band < a.length; band += 1) a[band] = bandWeight(band, a) / average;
    for (const category of categories) c.set(category, (c.get(category) ?? r0) * average);
  }
  return { c, a, r0 };
}

/** The per-machine daily rate under one method: the plan's 42b rate with this method's exposure. */
export function ratesOf(
  base: readonly LabMachine[],
  cut: number,
  method: MethodKey,
  halfLife: number,
): number[] {
  const useAge = method === 'M1' || method === 'M3';
  const recent = method === 'M2' || method === 'M3';
  const exposures = base.map((machine) => exposureOf(machine, cut, halfLife, recent));
  const groups = new Map<string, { t: number; nw: number; tw: number }>();
  base.forEach((machine, index) => {
    const group = groups.get(machine.category) ?? { t: 0, nw: 0, tw: 0 };
    group.t += machine.t;
    group.nw += exposures[index]?.nw ?? 0;
    group.tw += exposures[index]?.Tw ?? 0;
    groups.set(machine.category, group);
  });
  const fleetNw = sum(exposures.map((item) => item.nw));
  const fleetTw = sum(exposures.map((item) => item.Tw));
  const fleetRate = fleetTw > 0 ? fleetNw / fleetTw : 0;
  const bands: BandRow[] = useAge
    ? base.map((machine, index) => ({
        cat: machine.category,
        yrs: (exposures[index]?.Tw ?? 0) / 365,
        n: exposures[index]?.nw ?? 0,
        band: ageBand(machine, cut),
      }))
    : [];
  const fit = useAge ? fitBands(bands) : null;
  return base.map((machine, index) => {
    const exposure = exposures[index] ?? { nw: 0, Tw: 0, rho: 1 };
    const group = groups.get(machine.category) ?? { t: 0, nw: 0, tw: 0 };
    let lam0: number;
    if (fit !== null) {
      const band = bands[index]?.band ?? -1;
      const perYear =
        (fit.c.get(machine.category) ?? fit.r0) * (band >= 0 ? (fit.a[band] ?? 1) : 1);
      lam0 = perYear / 365;
    } else {
      lam0 =
        group.t - machine.t >= FC_PRIOR_DAYS
          ? (group.nw - exposure.nw) / (group.tw - exposure.Tw)
          : fleetRate;
    }
    lam0 = Math.max(lam0, 0.25 * fleetRate);
    return (
      (exposure.nw + lam0 * FC_PRIOR_DAYS * exposure.rho) /
      (exposure.Tw + FC_PRIOR_DAYS * exposure.rho)
    );
  });
}
