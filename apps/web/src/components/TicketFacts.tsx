import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { BreakdownReport, Config, Ticket } from '../api.js';
import { formatDateTime, formatMinutes, machineLabel } from './format.js';

const CLOSE_LABEL_KEYS = {
  report: 'close.report',
  no_report: 'close.noReport',
  done: 'close.done',
};

function waitLabel(code: string, config?: Config): string {
  const item = (config?.lists.wait_reason ?? []).find((entry) => entry.code === code);
  return item?.label ?? code;
}

interface Fact {
  label: string;
  value: string;
  wide?: boolean;
}

function fact(label: string, value: string | null | undefined, wide = false): Fact[] {
  return value ? [{ label, value, ...(wide ? { wide } : {}) }] : [];
}

/** Severity with the criticality snapshot it was derived from, e.g. "S1 (A)". */
function severityLabel(ticket: Ticket): string | null {
  if (!ticket.severity) return null;
  return ticket.criticalitySnapshot
    ? `${ticket.severity} (${ticket.criticalitySnapshot})`
    : ticket.severity;
}

function factRows(t: TFunction, ticket: Ticket, config?: Config): Fact[] {
  const machine =
    ticket.kind === 'general'
      ? t('floor.workRequest')
      : machineLabel(ticket, config?.machines ?? []);
  const lead = (config?.people ?? []).find((person) => person.id === ticket.leadPersonId);
  const time = (iso: string | null) => (iso ? formatDateTime(iso, config?.timeZone) : null);
  return [
    { label: t('ticket.fact.machine'), value: machine },
    {
      label: t('ticket.fact.reported'),
      value: formatDateTime(ticket.reportedAt, config?.timeZone),
    },
    ...fact(t('ticket.fact.severity'), severityLabel(ticket)),
    ...fact(t('ticket.fact.lead'), lead?.name),
    ...fact(t('ticket.fact.location'), ticket.location),
    ...fact(t('ticket.fact.workType'), ticket.workType),
    ...fact(t('ticket.fact.started'), time(ticket.startedAt)),
    ...fact(t('ticket.fact.machineRunning'), time(ticket.machineRunningAt)),
    ...fact(
      t('ticket.fact.pauseReason'),
      ticket.waitReason ? waitLabel(ticket.waitReason, config) : null,
    ),
    ...fact(t('ticket.fact.handover'), ticket.handedOver ? t('ticket.fact.waitingPickup') : null),
    ...fact(t('ticket.fact.closed'), time(ticket.closedAt)),
    ...fact(
      t('ticket.fact.closedAs'),
      ticket.closeKind ? t(CLOSE_LABEL_KEYS[ticket.closeKind]) : null,
    ),
    ...fact(t('ticket.fact.closeNote'), ticket.closeNote, true),
  ];
}

function FactList({ rows }: { rows: Fact[] }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
      {rows.map((row) => (
        <div key={row.label} className={row.wide ? 'col-span-2' : undefined}>
          <dt className="text-xs text-neutral-500">{row.label}</dt>
          <dd className="mt-0.5 text-base">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Facts({ ticket, config }: { ticket: Ticket; config?: Config }) {
  const { t } = useTranslation();
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">{t('ticket.facts')}</h2>
      <FactList rows={factRows(t, ticket, config)} />
    </section>
  );
}

function personList(
  ids: string[] | undefined,
  names: Record<string, string>,
  t: TFunction,
): string | null {
  if (!ids || ids.length === 0) return null;
  return ids.map((id) => names[id] ?? t('common.teamMember')).join(', ');
}

function reportPeople(report: BreakdownReport, role: 'done' | 'supported'): string[] {
  return report.people.filter((person) => person.role === role).map((person) => person.personId);
}

export function ReportCard({
  report,
  names,
}: {
  report: BreakdownReport;
  names: Record<string, string>;
}) {
  const { t } = useTranslation();
  const rows = [
    ...fact(t('report.problem'), report.problem, true),
    ...fact(t('report.observedBy'), report.observedBy),
    ...fact(t('report.correctiveAction'), report.correctiveAction, true),
    ...fact(t('report.doneBy'), personList(reportPeople(report, 'done'), names, t)),
    ...fact(t('report.supportedBy'), personList(reportPeople(report, 'supported'), names, t)),
    ...fact(t('report.downtime'), formatMinutes(report.downtimeMin)),
    ...fact(
      t('report.response'),
      report.responseMin == null ? null : formatMinutes(report.responseMin),
    ),
    ...fact(t('report.repair'), report.repairMin == null ? null : formatMinutes(report.repairMin)),
    ...fact(t('report.category'), report.breakdownCategory),
    ...fact(t('report.maintenanceCode'), report.maintCode),
    ...fact(t('report.spareUsed'), report.spareUsed),
    ...fact(t('report.rootCause'), report.rootCause, true),
    ...fact(t('report.handoverTo'), report.handoverName),
    ...fact(t('report.date'), report.date),
    ...fact(t('report.shift'), report.shiftCode),
  ];
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">{t('report.title')}</h2>
      <FactList rows={rows} />
    </section>
  );
}
