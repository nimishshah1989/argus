import type { IconName } from '../../../ui/v2/icons.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import { ageOf, type MachineRecord } from '../../analytics/machine-record.js';
import { dayText, type Translate } from '../figures/read.js';
import { drillOf, number } from './format.js';

const FLAT = { text: '', up: false, good: true, flat: true } as const;

type Spec = { id: string; icon: IconName; label: string; value: string; meaning: string };

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
function identityCards(record: MachineRecord, asOf: string, t: Translate): KpiData[] {
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
    }),
    card({
      id: 'connected-load',
      icon: 'gauge',
      label: t('analytics.machine.connectedLoad'),
      value: shown(record.connectedKva, 2, kva),
      meaning: record.connectedKva === null ? none : '',
    }),
    card({
      id: 'running-load',
      icon: 'gauge',
      label: t('analytics.machine.runningLoad'),
      value: shown(record.runningKva, 2, kva),
      meaning: record.runningKva === null ? none : factor,
    }),
  ];
}

/** Breakdowns, their hours and repair time, and PM hours: what the machine has cost, each opening its rows. */
function workCards(record: MachineRecord, machineId: string, t: Translate): KpiData[] {
  const none = t('analytics.machine.notAvailable');
  const bd = record.breakdowns;
  const hours = t('analytics.machine.unit.hours');
  const tickets = (label: string) =>
    drillOf({ machineId, part: 'breakdowns', ids: record.drills.breakdowns }, label, t);
  const spec = (
    id: string,
    icon: IconName,
    label: string,
    value: { n: number | null | undefined; unit?: string },
  ) =>
    card(
      {
        id,
        icon,
        label,
        value: shown(value.n, value.unit ? 2 : 0, value.unit),
        meaning: value.n == null ? none : '',
      },
      tickets(label),
    );
  const pmLabel = t('analytics.machine.pmHours');
  return [
    spec('breakdowns', 'alert', t('analytics.machine.breakdownCount'), { n: bd?.count }),
    spec('breakdown-hours', 'clock', t('analytics.machine.breakdownHours'), {
      n: bd?.hours,
      unit: hours,
    }),
    spec('mttr', 'wrench', t('analytics.machine.mttr'), { n: bd?.mttr, unit: hours }),
    card(
      {
        id: 'pm-hours',
        icon: 'wrench',
        label: pmLabel,
        value: shown(record.pm?.hours, 2, hours),
        meaning: record.pm?.hours == null ? none : '',
      },
      drillOf({ machineId, part: 'pm', ids: record.drills.pm }, pmLabel, t),
    ),
  ];
}

/** The eight headline figures: what the machine is (age, size, load) and what it has cost. */
export const kpisOf = (
  record: MachineRecord,
  asOf: string,
  machineId: string,
  t: Translate,
): KpiData[] => [...identityCards(record, asOf, t), ...workCards(record, machineId, t)];
