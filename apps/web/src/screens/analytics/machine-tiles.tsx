import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { KpiTile, type Family } from '../../ui/elements/index.js';
import { ChevronRight } from '../../ui/icon.js';
import { ageOf, type MachineRecord } from './machine-record.js';
import { displayDay } from './machine-values.js';
import { NOT_AVAILABLE, number } from './machine-parts.js';
import './register-parts.css';

/** The machine page's headline figures, one tile each: the engine's value, its unit, or a dash that says why. */

interface TileSpec {
  id: string;
  label: string;
  /** Null prints a dash and the words "Not available": a missing fact is never a zero. */
  value: number | null;
  digits: number;
  unit?: string;
  note?: string | null;
  family?: Family;
  /** The rows behind the figure; the whole tile opens them. */
  href?: string;
}

function Tile({ spec }: { spec: TileSpec }) {
  const { t } = useTranslation();
  const { value, digits, unit, href } = spec;
  return (
    <div className="rg-tile" data-figure={spec.id}>
      <KpiTile
        label={spec.label}
        value={value}
        format={(shown) => number(shown, digits)}
        unit={value === null ? undefined : unit}
        verdict={value === null ? t(NOT_AVAILABLE) : undefined}
        note={spec.note ?? undefined}
        family={spec.family}
        action={href ? <ChevronRight aria-hidden size={16} className="shrink-0" /> : undefined}
      />
      {href ? (
        <Link
          to={href}
          aria-label={t('analytics.today.rowsFor', { figure: spec.label })}
          className="rg-tile-link"
        />
      ) : null}
    </div>
  );
}

const drillOf = (machineId: string, type: string, ids: readonly string[]): string | undefined =>
  ids.length === 0
    ? undefined
    : `/analytics/machines/${machineId}?drill=${encodeURIComponent(`${type}:${ids.join(',')}`)}`;

/** Age, floor area and the two loads: what the machine is. */
function identityTiles(record: MachineRecord, asOf: string, t: TFunction): TileSpec[] {
  const age = ageOf(record.machine, asOf, record.ageYears, record.ageEstimated);
  // When there is no running load the tile already says "Not available"; the efficiency line says it only otherwise.
  const efficiency =
    record.efficiencyPct !== null
      ? t('analytics.machine.efficiency', { pct: record.efficiencyPct })
      : record.runningKva !== null
        ? t(NOT_AVAILABLE)
        : null;
  return [
    {
      id: 'age',
      label: t('analytics.machine.age'),
      value: age?.years ?? null,
      digits: 0,
      unit: t('analytics.machine.unit.years'),
      note:
        age === null
          ? t('analytics.machine.noPurchase')
          : age.estimated
            ? t('analytics.machine.ageEstimated')
            : t('analytics.machine.ageBasis', { date: displayDay(asOf) }),
    },
    {
      id: 'floor-area',
      label: t('analytics.machine.floorArea'),
      value: record.floorAreaM2,
      digits: 2,
      unit: t('analytics.machine.unit.m2'),
      note:
        record.floorAreaM2 === null
          ? t('analytics.machine.noSize')
          : t('analytics.machine.floorAreaBasis'),
    },
    {
      id: 'connected-load',
      label: t('analytics.machine.connectedLoad'),
      value: record.connectedKva,
      digits: 2,
      unit: t('analytics.machine.unit.kva'),
    },
    {
      id: 'running-load',
      label: t('analytics.machine.runningLoad'),
      value: record.runningKva,
      digits: 2,
      unit: t('analytics.machine.unit.kva'),
      note: efficiency,
    },
  ];
}

/** Breakdowns, their hours and repair time, and PM hours: what the machine has cost, each opening its rows. */
function workTiles(record: MachineRecord, machineId: string, t: TFunction): TileSpec[] {
  const bd = record.breakdowns;
  const hours = t('analytics.machine.unit.hours');
  const tickets = drillOf(machineId, 'ticket', record.drills.breakdowns);
  return [
    {
      id: 'breakdowns',
      label: t('analytics.machine.breakdownCount'),
      value: bd?.count ?? null,
      digits: 0,
      family: 'downtime',
      href: tickets,
    },
    {
      id: 'breakdown-hours',
      label: t('analytics.machine.breakdownHours'),
      value: bd?.hours ?? null,
      digits: 2,
      unit: hours,
      family: 'downtime',
      href: tickets,
    },
    {
      id: 'mttr',
      label: t('analytics.machine.mttr'),
      value: bd?.mttr ?? null,
      digits: 2,
      unit: hours,
      family: 'repairs',
      href: tickets,
    },
    {
      id: 'pm-hours',
      label: t('analytics.machine.pmHours'),
      value: record.pm?.hours ?? null,
      digits: 2,
      unit: hours,
      family: 'planned',
      href: drillOf(machineId, 'ticket', record.drills.pm),
    },
  ];
}

/** The eight tiles of the figures row, in two rows of four on a wide screen. */
export function MachineTiles({
  record,
  asOf,
  machineId,
}: {
  record: MachineRecord;
  asOf: string;
  machineId: string;
}): ReactNode {
  const { t } = useTranslation();
  return [...identityTiles(record, asOf, t), ...workTiles(record, machineId, t)].map((spec) => (
    <Tile key={spec.id} spec={spec} />
  ));
}
