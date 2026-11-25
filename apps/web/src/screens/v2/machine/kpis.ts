import type { IconName } from '../../../ui/v2/icons.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import { ageOf, machineRecord, type MachineRecord } from '../../analytics/machine-record.js';
import { bag } from '../../analytics/read-value.js';
import { dayText, type Translate } from '../figures/read.js';
import { drillOf, number } from './format.js';

const FLAT = { text: '', up: false, good: true, flat: true } as const;

type Spec = {
  id: string;
  icon: IconName;
  label: string;
  value: string;
  meaning: string;
  yardstick?: string;
};

/** The machine's rank in the plant for one figure, as the tile's yardstick; undefined when the machine has no value. */
type Rank = (value: (record: MachineRecord) => number | null | undefined) => string | undefined;

/** Every machine's record in the engine's `machine-page` figure (just this one when the figure holds no map). */
function plantOf(page: unknown, record: MachineRecord): MachineRecord[] {
  const root = bag(page);
  const map = bag(root?.byMachine) ?? bag(root?.machines);
  return map ? Object.keys(map).flatMap((id) => machineRecord(page, id) ?? []) : [record];
}

/** Competition rank (ties share it), highest first, among the machines that have the value. */
const rankIn =
  (plant: MachineRecord[], record: MachineRecord, t: Translate): Rank =>
  (value) => {
    const mine = value(record);
    if (mine == null) return undefined;
    const all = plant.flatMap((r) => value(r) ?? []);
    return t('analytics.machine.rank', {
      rank: 1 + all.filter((v) => v > mine).length,
      n: all.length,
    });
  };

const card = (spec: Spec, drill?: KpiData['drill']): KpiData => ({
  ...spec,
  delta: FLAT,
  period: '',
  more: '',
  drill,
});

/** A figure with its unit, or a dash when the plant never recorded it: a missing fact is never a zero. */
const shown = (n: number | null | undefined, digits: number, unit?: string): string =>
  n == null ? '—' : `${number(n, digits)}${unit ? ` ${unit}` : ''}`;

/** Age with its basis (or "no purchase date"), the floor area and the two loads: what the machine is. */
function identityCards(record: MachineRecord, asOf: string, rank: Rank, t: Translate): KpiData[] {
  const none = t('analytics.machine.notAvailable');
  const age = ageOf(record.machine, asOf, record.ageYears, record.ageEstimated);
  const basis = age?.estimated
    ? t('analytics.machine.ageEstimated')
    : t('analytics.machine.ageBasis', { date: dayText(asOf) });
  const factor =
    record.efficiencyPct === null
      ? record.runningKva === null
        ? ''
        : none
      : t('analytics.machine.efficiency', { pct: record.efficiencyPct });
  const kva = t('analytics.machine.unit.kva');
  return [
    card({
      id: 'age',
      icon: 'clock',
      label: t('analytics.machine.age'),
      value: shown(age?.years, 0, t('analytics.machine.unit.years')),
      meaning: age === null ? t('analytics.machine.noPurchase') : basis,
      yardstick: rank((r) => ageOf(r.machine, asOf, r.ageYears, r.ageEstimated)?.years),
    }),
    card({
      id: 'floor-area',
      icon: 'cell',
      label: t('analytics.machine.floorArea'),
      value: shown(record.floorAreaM2, 2, t('analytics.machine.unit.m2')),
      meaning:
        record.floorAreaM2 === null
          ? t('analytics.machine.noSize')
          : t('analytics.machine.floorAreaBasis'),
      yardstick: rank((r) => r.floorAreaM2),
    }),
    card({
      id: 'connected-load',
      icon: 'gauge',
      label: t('analytics.machine.connectedLoad'),
      value: shown(record.connectedKva, 2, kva),
      meaning: record.connectedKva === null ? none : '',
      yardstick: rank((r) => r.connectedKva),
    }),
    card({
      id: 'running-load',
      icon: 'gauge',
      label: t('analytics.machine.runningLoad'),
      value: shown(record.runningKva, 2, kva),
      meaning: record.runningKva === null ? none : factor,
      yardstick: rank((r) => r.runningKva),
    }),
  ];
}

/** Breakdowns, their hours and repair time, and PM hours: what the machine has cost, each opening its rows. */
function workCards(record: MachineRecord, machineId: string, rank: Rank, t: Translate): KpiData[] {
  const none = t('analytics.machine.notAvailable');
  const hours = t('analytics.machine.unit.hours');
  const tickets = (label: string) =>
    drillOf({ machineId, part: 'breakdowns', ids: record.drills.breakdowns }, label, t);
  const spec = (
    id: string,
    icon: IconName,
    label: string,
    value: { of: (r: MachineRecord) => number | null | undefined; unit?: string },
  ) => {
    const n = value.of(record);
    return card(
      {
        id,
        icon,
        label,
        value: shown(n, value.unit ? 2 : 0, value.unit),
        meaning: n == null ? none : '',
        yardstick: rank(value.of),
      },
      tickets(label),
    );
  };
  const pmLabel = t('analytics.machine.pmHours');
  return [
    spec('breakdowns', 'alert', t('analytics.machine.breakdownCount'), {
      of: (r) => r.breakdowns?.count,
    }),
    spec('breakdown-hours', 'clock', t('analytics.machine.breakdownHours'), {
      of: (r) => r.breakdowns?.hours,
      unit: hours,
    }),
    spec('mttr', 'wrench', t('analytics.machine.mttr'), {
      of: (r) => r.breakdowns?.mttr,
      unit: hours,
    }),
    card(
      {
        id: 'pm-hours',
        icon: 'wrench',
        label: pmLabel,
        value: shown(record.pm?.hours, 2, hours),
        meaning: record.pm?.hours == null ? none : '',
        yardstick: rank((r) => r.pm?.hours),
      },
      drillOf({ machineId, part: 'pm', ids: record.drills.pm }, pmLabel, t),
    ),
  ];
}

/** The eight headline figures: what the machine is (age, size, load) and what it has cost, each ranked in the plant. */
export function kpisOf(
  record: MachineRecord,
  at: { page: unknown; asOf: string },
  machineId: string,
  t: Translate,
): KpiData[] {
  const { page, asOf } = at;
  const rank = rankIn(plantOf(page, record), record, t);
  return [...identityCards(record, asOf, rank, t), ...workCards(record, machineId, rank, t)];
}
