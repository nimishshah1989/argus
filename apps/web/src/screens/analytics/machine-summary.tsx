import { useTranslation } from 'react-i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import { Stack } from '../../ui/layout.js';
import { MACHINE_FIELD_LABELS, type MachineRecord } from './machine-record.js';
import { displayDay } from './machine-values.js';
import { DataTable, Section, StatCard } from './parts.js';
import { DrillAction, MachineFigures, NOT_AVAILABLE, Nameplate, number } from './machine-parts.js';
import { MachineTasks } from './machine-tasks.js';

/** The machine page's breakdown, PM, completeness and move blocks, gathered into one record body. */

const UNIT_HOURS: MessageKey = 'analytics.machine.unit.hours';

export function Breakdowns({ record, machineId }: { record: MachineRecord; machineId: string }) {
  const { t } = useTranslation();
  const bd = record.breakdowns;
  return (
    <Section
      title={t('analytics.machine.breakdowns')}
      action={<DrillAction machineId={machineId} type="ticket" ids={record.drills.breakdowns} />}
    >
      {bd === null ? (
        <p className="text-body text-neutral-600">{t(NOT_AVAILABLE)}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <StatCard
              label={t('analytics.machine.breakdownCount')}
              value={bd.count === null ? t(NOT_AVAILABLE) : number(bd.count, 0)}
              sub={t('analytics.machine.breakdownHours')}
            />
          </li>
          <li>
            <StatCard
              label={t('analytics.machine.breakdownHours')}
              value={bd.hours === null ? t(NOT_AVAILABLE) : number(bd.hours, 2)}
              unit={bd.hours === null ? undefined : UNIT_HOURS}
            />
          </li>
          <li>
            <StatCard
              label={t('analytics.machine.mttr')}
              value={bd.mttr === null ? t(NOT_AVAILABLE) : number(bd.mttr, 2)}
              unit={bd.mttr === null ? undefined : UNIT_HOURS}
            />
          </li>
          <li>
            <StatCard
              label={t('analytics.machine.lastBreakdown')}
              value={bd.lastOn === null ? t(NOT_AVAILABLE) : displayDay(bd.lastOn)}
            />
          </li>
          <li>
            <StatCard
              label={t('analytics.machine.topProblem')}
              value={bd.topProblem?.problem ?? t(NOT_AVAILABLE)}
            />
          </li>
        </ul>
      )}
    </Section>
  );
}

export function Pm({ record, machineId }: { record: MachineRecord; machineId: string }) {
  const { t } = useTranslation();
  const pm = record.pm;
  return (
    <Section
      title={t('analytics.machine.pm')}
      action={<DrillAction machineId={machineId} type="ticket" ids={record.drills.pm} />}
    >
      {pm === null ? (
        <p className="text-body text-neutral-600">{t(NOT_AVAILABLE)}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <StatCard
              label={t('analytics.machine.pmVisits')}
              value={pm.visits === null ? t(NOT_AVAILABLE) : number(pm.visits, 0)}
            />
          </li>
          <li>
            <StatCard
              label={t('analytics.machine.pmHours')}
              value={pm.hours === null ? t(NOT_AVAILABLE) : number(pm.hours, 2)}
              unit={pm.hours === null ? undefined : UNIT_HOURS}
            />
          </li>
        </ul>
      )}
    </Section>
  );
}

export function Completeness({ record }: { record: MachineRecord }) {
  const { t } = useTranslation();
  const complete = record.completeness;
  const missing = complete?.missing
    .map((code) => MACHINE_FIELD_LABELS[code])
    .filter((key): key is MessageKey => key !== undefined)
    .map((key) => t(key))
    .join(', ');
  return (
    <Section title={t('analytics.machine.completeness')}>
      {complete === null ? (
        <p className="text-body text-neutral-600">{t(NOT_AVAILABLE)}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <StatCard
              label={t('analytics.machine.completeness')}
              value={t('analytics.machine.completenessValue', {
                recorded: complete.recorded,
                of: complete.of,
              })}
              sub={missing ? t('analytics.machine.missing', { fields: missing }) : null}
            />
          </li>
        </ul>
      )}
    </Section>
  );
}

export function Moves({ record, machineId }: { record: MachineRecord; machineId: string }) {
  const { t } = useTranslation();
  const absent = t('analytics.value.none');
  const rows = record.moves.map((move) => [
    displayDay(move.date),
    `${move.fromCell ?? absent} → ${move.toCell ?? absent}`,
    move.fromLocation !== null && move.fromLocation === move.toLocation
      ? t('analytics.cellLog.noChange')
      : `${move.fromLocation ?? absent} → ${move.toLocation ?? absent}`,
  ]);
  return (
    <Section
      title={t('analytics.machine.moves')}
      action={<DrillAction machineId={machineId} type="move" ids={record.drills.moves} />}
    >
      {rows.length === 0 ? (
        <p className="text-body text-neutral-600">{t('analytics.machine.noMoves')}</p>
      ) : (
        <DataTable
          header={[
            t('analytics.cellLog.date'),
            t('analytics.cellLog.cell'),
            t('analytics.cellLog.location'),
          ]}
          rows={rows}
        />
      )}
    </Section>
  );
}

/** Everything one ready record holds. */
export function RecordBody({
  record,
  asOf,
  machineId,
}: {
  record: MachineRecord;
  asOf: string;
  machineId: string;
}) {
  return (
    <Stack gap={6}>
      <Nameplate machine={record.machine} machineId={machineId} />
      <MachineFigures record={record} asOf={asOf} machineId={machineId} />
      <Breakdowns record={record} machineId={machineId} />
      <Pm record={record} machineId={machineId} />
      <MachineTasks machineId={machineId} today={asOf} />
      <Completeness record={record} />
      <Moves record={record} machineId={machineId} />
    </Stack>
  );
}

/**
 * One machine's page (39b) at `/analytics/machines/:id`: nameplate, age, floor area, load, breakdown summary,
 * PM visits/hours, record completeness and the cell moves, every block drilled to the rows behind it. A figure
 * that is not computed, a record the engine does not hold and a fact the plant never recorded all say so.
 */
