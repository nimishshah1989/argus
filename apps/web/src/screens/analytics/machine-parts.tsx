import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import { ageOf, type MachineFacts, type MachineRecord } from './machine-record.js';
import { displayDay } from './machine-values.js';
import { Section, StatCard } from './parts.js';

/** The machine page's nameplate and its derived figures (age, floor area, connected and running load). */

export const NOT_AVAILABLE: MessageKey = 'analytics.machine.notAvailable';
const UNIT_YEARS: MessageKey = 'analytics.machine.unit.years';
const UNIT_M2: MessageKey = 'analytics.machine.unit.m2';
const UNIT_KVA: MessageKey = 'analytics.machine.unit.kva';

export function number(value: number, digits: number): string {
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

type FactItem = { labelKey: MessageKey; value: string | null };

function Fact({ labelKey, value }: FactItem) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-caption text-neutral-600">{t(labelKey)}</dt>
      <dd className="text-body font-semibold">{value}</dd>
    </div>
  );
}

export function DrillAction({
  machineId,
  type,
  ids,
}: {
  machineId: string;
  type: string;
  ids: string[];
}) {
  const { t } = useTranslation();
  if (ids.length === 0) return null;
  const drill = encodeURIComponent(`${type}:${ids.join(',')}`);
  return (
    <Link
      to={`/analytics/machines/${machineId}?drill=${drill}`}
      className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
    >
      {t('analytics.machine.seeRows')}
    </Link>
  );
}

/** The nameplate: what the machine is, with a missing fact left out rather than guessed. */
export function Nameplate({ machine, machineId }: { machine: MachineFacts; machineId: string }) {
  const { t } = useTranslation();
  const items: FactItem[] = [
    { labelKey: 'analytics.machine.fact.segment', value: machine.segment },
    { labelKey: 'analytics.machine.fact.category', value: machine.category },
    { labelKey: 'analytics.machine.fact.make', value: machine.make },
    { labelKey: 'analytics.machine.fact.model', value: machine.model },
    { labelKey: 'analytics.machine.fact.serial', value: machine.serial },
    { labelKey: 'analytics.machine.fact.controller', value: machine.controller },
    { labelKey: 'analytics.machine.fact.controllerModel', value: machine.controllerModel },
    { labelKey: 'analytics.machine.fact.controllerSerial', value: machine.controllerSerial },
    { labelKey: 'analytics.machine.fact.assetCode', value: machine.assetCode },
    {
      labelKey: 'analytics.machine.fact.year',
      value: machine.year === null ? null : String(machine.year),
    },
    {
      labelKey: 'analytics.machine.fact.purchasedOn',
      value: machine.purchasedOn === null ? null : displayDay(machine.purchasedOn),
    },
    { labelKey: 'analytics.machine.fact.cell', value: machine.cell },
    { labelKey: 'analytics.machine.fact.location', value: machine.location },
    { labelKey: 'analytics.machine.fact.conveyor', value: machine.conveyor },
  ];
  const shown = items.filter((item) => item.value !== null);
  return (
    <Section
      title={t('analytics.machine.nameplate')}
      action={<DrillAction machineId={machineId} type="machine" ids={[machineId]} />}
    >
      {shown.length === 0 ? (
        <p className="text-body text-neutral-600">{t(NOT_AVAILABLE)}</p>
      ) : (
        <dl className="grid grid-cols-1 gap-3 rounded-2xl bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((item) => (
            <Fact key={item.labelKey} {...item} />
          ))}
        </dl>
      )}
    </Section>
  );
}

function AgeCard({ record, asOf }: { record: MachineRecord; asOf: string }) {
  const { t } = useTranslation();
  const age = ageOf(record.machine, asOf, record.ageYears, record.ageEstimated);
  const sub = age?.estimated
    ? t('analytics.machine.ageEstimated')
    : t('analytics.machine.ageBasis', { date: displayDay(asOf) });
  return (
    <StatCard
      label={t('analytics.machine.age')}
      value={age === null ? t(NOT_AVAILABLE) : number(age.years, 0)}
      unit={age === null ? undefined : UNIT_YEARS}
      sub={age === null ? t('analytics.machine.noPurchase') : sub}
    />
  );
}

function AreaCard({ record }: { record: MachineRecord }) {
  const { t } = useTranslation();
  const area = record.floorAreaM2;
  return (
    <StatCard
      label={t('analytics.machine.floorArea')}
      value={area === null ? t(NOT_AVAILABLE) : number(area, 2)}
      unit={area === null ? undefined : UNIT_M2}
      sub={area === null ? t('analytics.machine.noSize') : t('analytics.machine.floorAreaBasis')}
    />
  );
}

function ConnectedCard({ record }: { record: MachineRecord }) {
  const { t } = useTranslation();
  const connected = record.connectedKva;
  return (
    <StatCard
      label={t('analytics.machine.connectedLoad')}
      value={connected === null ? t(NOT_AVAILABLE) : number(connected, 2)}
      unit={connected === null ? undefined : UNIT_KVA}
    />
  );
}

function RunningCard({ record }: { record: MachineRecord }) {
  const { t } = useTranslation();
  const running = record.runningKva;
  const efficiency =
    record.efficiencyPct === null
      ? t(NOT_AVAILABLE)
      : t('analytics.machine.efficiency', { pct: record.efficiencyPct });
  return (
    <StatCard
      label={t('analytics.machine.runningLoad')}
      value={running === null ? t(NOT_AVAILABLE) : number(running, 2)}
      unit={running === null ? undefined : UNIT_KVA}
      sub={efficiency}
    />
  );
}

/** Age, floor area and load: each says why it is unavailable instead of showing a number it lacks. */
export function MachineFigures({
  record,
  asOf,
  machineId,
}: {
  record: MachineRecord;
  asOf: string;
  machineId: string;
}) {
  const { t } = useTranslation();
  return (
    <Section
      title={t('analytics.machine.title')}
      action={<DrillAction machineId={machineId} type="machine" ids={[machineId]} />}
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <li>
          <AgeCard record={record} asOf={asOf} />
        </li>
        <li>
          <AreaCard record={record} />
        </li>
        <li>
          <ConnectedCard record={record} />
        </li>
        <li>
          <RunningCard record={record} />
        </li>
      </ul>
    </Section>
  );
}
