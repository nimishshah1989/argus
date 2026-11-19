/* eslint-disable i18next/no-literal-string -- template kind, state and fact ids are prop values, not copy */
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import type { MessageKey } from '@uptimo/shared/i18n';
import { Card } from '../../ui/card.js';
import { MACHINE_FIELD_LABELS, type MachineRecord } from './machine-record.js';
import { displayDay } from './machine-values.js';
import { Block, Facts } from './facts.js';
import { EngineTable } from './engine-table.js';
import { DrillAction, NOT_AVAILABLE, Nameplate, number } from './machine-parts.js';
import { MachineTasks } from './machine-tasks.js';
import { Reliability } from './reliability-parts.js';

/** The machine page's breakdown, PM, completeness and move blocks, gathered into its main and side columns. */

type Figure = FiguresReply['figures'][number];

function Breakdowns({ record, machineId }: { record: MachineRecord; machineId: string }) {
  const { t } = useTranslation();
  const bd = record.breakdowns;
  const none = t(NOT_AVAILABLE);
  return (
    <Card title={t('analytics.machine.breakdowns')}>
      <Facts
        facts={[
          {
            id: 'last',
            label: t('analytics.machine.lastBreakdown'),
            value: bd?.lastOn == null ? none : displayDay(bd.lastOn),
          },
          {
            id: 'top',
            label: t('analytics.machine.topProblem'),
            value: bd?.topProblem?.problem ?? none,
          },
        ]}
      />
      <DrillAction machineId={machineId} type="ticket" ids={record.drills.breakdowns} />
    </Card>
  );
}

function Pm({ record, machineId }: { record: MachineRecord; machineId: string }) {
  const { t } = useTranslation();
  const pm = record.pm;
  return (
    <Card title={t('analytics.machine.pm')}>
      <Facts
        facts={[
          {
            id: 'visits',
            label: t('analytics.machine.pmVisits'),
            value: pm?.visits == null ? t(NOT_AVAILABLE) : number(pm.visits, 0),
          },
          {
            id: 'hours',
            label: t('analytics.machine.pmHours'),
            value:
              pm?.hours == null
                ? t(NOT_AVAILABLE)
                : `${number(pm.hours, 2)} ${t('analytics.machine.unit.hours')}`,
          },
        ]}
      />
      <DrillAction machineId={machineId} type="ticket" ids={record.drills.pm} />
    </Card>
  );
}

function Completeness({ record }: { record: MachineRecord }) {
  const { t } = useTranslation();
  const complete = record.completeness;
  const missing = complete?.missing
    .map((code) => MACHINE_FIELD_LABELS[code])
    .filter((key): key is MessageKey => key !== undefined)
    .map((key) => t(key))
    .join(', ');
  return (
    <Card title={t('analytics.machine.completeness')}>
      <Facts
        facts={[
          {
            id: 'recorded',
            label: t('analytics.machine.completeness'),
            value:
              complete === null
                ? t(NOT_AVAILABLE)
                : t('analytics.machine.completenessValue', {
                    recorded: complete.recorded,
                    of: complete.of,
                  }),
            note: missing ? t('analytics.machine.missing', { fields: missing }) : null,
          },
        ]}
      />
    </Card>
  );
}

function Moves({ record, machineId }: { record: MachineRecord; machineId: string }) {
  const { t } = useTranslation();
  const absent = t('analytics.value.none');
  const rows = record.moves.map((move, index) => ({
    index,
    row: [
      displayDay(move.date),
      `${move.fromCell ?? absent} → ${move.toCell ?? absent}`,
      move.fromLocation !== null && move.fromLocation === move.toLocation
        ? t('analytics.cellLog.noChange')
        : `${move.fromLocation ?? absent} → ${move.toLocation ?? absent}`,
    ],
  }));
  return (
    <Block
      title={t('analytics.machine.moves')}
      action={<DrillAction machineId={machineId} type="move" ids={record.drills.moves} />}
    >
      {rows.length === 0 ? (
        <p className="rg-note">{t('analytics.machine.noMoves')}</p>
      ) : (
        <EngineTable
          caption={t('analytics.machine.moves')}
          header={[
            t('analytics.cellLog.date'),
            t('analytics.cellLog.cell'),
            t('analytics.cellLog.location'),
          ]}
          rows={rows}
          unsortable={new Set([1, 2])}
        />
      )}
    </Block>
  );
}

/** The long part of the page: what went wrong, how it is likely to, what is open and where the machine has been. */
export function MachineMain({
  record,
  asOf,
  machineId,
  reliability,
}: {
  record: MachineRecord;
  asOf: string;
  machineId: string;
  /** The stored `reliability` figure, found by key: the block reads this machine's entry from it. */
  reliability: Figure | undefined;
}) {
  return (
    <>
      <Breakdowns record={record} machineId={machineId} />
      <Reliability figure={reliability} machineId={machineId} />
      <MachineTasks machineId={machineId} today={asOf} />
      <Moves record={record} machineId={machineId} />
    </>
  );
}

/** What the machine is, beside the long part: its nameplate, its PM visits and how complete its record is. */
export function MachineAside({ record, machineId }: { record: MachineRecord; machineId: string }) {
  return (
    <>
      <Nameplate machine={record.machine} machineId={machineId} />
      <Pm record={record} machineId={machineId} />
      <Completeness record={record} />
    </>
  );
}
