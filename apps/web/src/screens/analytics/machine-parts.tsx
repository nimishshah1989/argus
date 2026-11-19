import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import { Card } from '../../ui/card.js';
import type { MachineFacts } from './machine-record.js';
import { displayDay } from './machine-values.js';
import { Facts } from './facts.js';
import './register-parts.css';

/** The machine page's nameplate and the pieces its other blocks share. */

export const NOT_AVAILABLE: MessageKey = 'analytics.machine.notAvailable';

/** A number as the plant reads it: Indian grouping, a fixed count of places (an hours figure has at least one). */
export function number(value: number, digits: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** The way to the rows behind a block: they open above the page, in the face's one drill table. */
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
    <Link to={`/analytics/machines/${machineId}?drill=${drill}`} className="rg-link">
      {t('analytics.machine.seeRows')}
    </Link>
  );
}

/** The nameplate: what the machine is, with a missing fact left out rather than guessed. */
export function Nameplate({ machine, machineId }: { machine: MachineFacts; machineId: string }) {
  const { t } = useTranslation();
  const items: [MessageKey, string | null][] = [
    ['analytics.machine.fact.segment', machine.segment],
    ['analytics.machine.fact.category', machine.category],
    ['analytics.machine.fact.make', machine.make],
    ['analytics.machine.fact.model', machine.model],
    ['analytics.machine.fact.serial', machine.serial],
    ['analytics.machine.fact.controller', machine.controller],
    ['analytics.machine.fact.controllerModel', machine.controllerModel],
    ['analytics.machine.fact.controllerSerial', machine.controllerSerial],
    ['analytics.machine.fact.assetCode', machine.assetCode],
    ['analytics.machine.fact.year', machine.year === null ? null : String(machine.year)],
    [
      'analytics.machine.fact.purchasedOn',
      machine.purchasedOn === null ? null : displayDay(machine.purchasedOn),
    ],
    ['analytics.machine.fact.cell', machine.cell],
    ['analytics.machine.fact.location', machine.location],
    ['analytics.machine.fact.conveyor', machine.conveyor],
  ];
  const shown = items.flatMap(([key, value]) =>
    value === null ? [] : [{ id: key, label: t(key), value }],
  );
  return (
    <Card title={t('analytics.machine.nameplate')}>
      {shown.length === 0 ? <p className="rg-note">{t(NOT_AVAILABLE)}</p> : <Facts facts={shown} />}
      <DrillAction machineId={machineId} type="machine" ids={[machineId]} />
    </Card>
  );
}
