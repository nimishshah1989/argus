import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { BreakdownReport, Config, Ticket } from '../api.js';
import { FactList, SectionTitle, type FactRow } from '../ui/detail-kit.js';
import { Stack } from '../ui/layout.js';
import { formatDateTime, formatMinutes } from './format.js';
import { PmReportCard } from './PmReport.js';

const CLOSE_LABEL_KEYS = {
  report: 'close.report',
  no_report: 'close.noReport',
  done: 'close.done',
};

const KIND_KEYS = {
  stopped: 'detail.kind.stopped',
  support: 'detail.kind.support',
  general: 'detail.kind.general',
} as const;

function waitLabel(code: string, config?: Config): string {
  const item = (config?.lists.wait_reason ?? []).find((entry) => entry.code === code);
  return item?.label ?? code;
}

function fact(label: string, value: string | null | undefined): FactRow[] {
  return value ? [{ label, value }] : [];
}

/** Severity with the criticality snapshot it was derived from, e.g. "S1 (A)". */
function severityLabel(ticket: Ticket): string | null {
  if (!ticket.severity) return null;
  return ticket.criticalitySnapshot
    ? `${ticket.severity} (${ticket.criticalitySnapshot})`
    : ticket.severity;
}

/** The role's name; the catalogue spells `plant_head` as `plantHead`. */
function roleLabel(t: TFunction, role: string | null): string | null {
  if (!role) return null;
  const camel = role.replace(/_(\w)/g, (_, letter: string) => letter.toUpperCase());
  return t(`account.role.${camel}`, { defaultValue: role });
}

/** A time with who did it, e.g. "09:58 by Person 11 (Operator)". */
function atBy(t: TFunction, time: string, name?: string, role?: string | null): string {
  if (!name) return time;
  return role ? t('detail.byRole', { time, name, role }) : t('detail.by', { time, name });
}

interface FactsProps {
  ticket: Ticket;
  config?: Config;
  names: Record<string, string>;
  /** An open breakdown's downtime so far. */
  liveDownMin?: number;
}

function minutesRows(t: TFunction, ticket: Ticket, liveDownMin?: number): FactRow[] {
  const figures = ticket.figures;
  if (!figures) return [];
  const live = ['open', 'working', 'waiting'].includes(ticket.status);
  const downtime = figures.downtimeMin ?? (live ? liveDownMin : figures.downAccMin);
  const minutes = (label: string, value: number | null | undefined): FactRow[] =>
    value == null ? [] : [{ label, value: formatMinutes(value) }];
  const work = formatMinutes(figures.activeMin);
  return [
    ...minutes(t('detail.fact.response'), figures.responseMin),
    {
      label: t('detail.fact.workTime'),
      value: ticket.status === 'working' ? t('detail.running', { time: work }) : work,
    },
    { label: t('detail.fact.waiting'), value: formatMinutes(figures.waitMin) },
    ...(figures.vendorMin > 0 ? minutes(t('figures.vendorWait'), figures.vendorMin) : []),
    ...(figures.handoverWaitMin > 0
      ? minutes(t('figures.handoverWait'), figures.handoverWaitMin)
      : []),
    ...minutes(t('figures.followUp'), figures.followMin),
    ...(ticket.kind === 'stopped' && downtime != null
      ? [
          {
            label: t('detail.fact.downtime'),
            value: live
              ? t('detail.soFar', { time: formatMinutes(downtime) })
              : formatMinutes(downtime),
          },
        ]
      : []),
  ];
}

function closeRows(t: TFunction, ticket: Ticket, config?: Config, closer?: string): FactRow[] {
  const closed = ticket.closedAt ? formatDateTime(ticket.closedAt, config?.timeZone) : null;
  return [
    ...fact(t('ticket.fact.closed'), closed && atBy(t, closed, closer)),
    ...fact(
      t('ticket.fact.closedAs'),
      ticket.closeKind ? t(CLOSE_LABEL_KEYS[ticket.closeKind]) : null,
    ),
    ...fact(t('ticket.fact.closeNote'), ticket.closeNote),
  ];
}

function factRows(t: TFunction, props: FactsProps): FactRow[] {
  const { ticket, config, names, liveDownMin } = props;
  const lead = (config?.people ?? []).find((person) => person.id === ticket.leadPersonId);
  const time = (iso: string | null) => (iso ? formatDateTime(iso, config?.timeZone) : null);
  const reporter = ticket.reportedByPersonId ? names[ticket.reportedByPersonId] : undefined;
  const closer = ticket.closedByPersonId ? names[ticket.closedByPersonId] : undefined;
  const started = time(ticket.startedAt);
  return [
    { label: t('detail.fact.type'), value: t(KIND_KEYS[ticket.kind]) },
    {
      label: t('detail.fact.reported'),
      value: atBy(
        t,
        formatDateTime(ticket.reportedAt, config?.timeZone),
        reporter,
        roleLabel(t, ticket.reportedByRole),
      ),
    },
    ...fact(t('ticket.fact.severity'), severityLabel(ticket)),
    ...fact(t('ticket.fact.lead'), lead?.name),
    ...fact(t('ticket.fact.location'), ticket.location),
    ...fact(t('ticket.fact.workType'), ticket.workType),
    ...fact(t('detail.fact.workStarted'), started && atBy(t, started, lead?.name)),
    ...fact(t('ticket.fact.machineRunning'), time(ticket.machineRunningAt)),
    ...minutesRows(t, ticket, liveDownMin),
    ...fact(
      t('ticket.fact.pauseReason'),
      ticket.waitReason ? waitLabel(ticket.waitReason, config) : null,
    ),
    ...fact(t('ticket.fact.handover'), ticket.handedOver ? t('ticket.fact.waitingPickup') : null),
    ...closeRows(t, ticket, config, closer),
  ];
}

export function Facts(props: FactsProps) {
  const { t } = useTranslation();
  return <FactList rows={factRows(t, props)} />;
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
  // A PM job's report is its checklist, not a breakdown's codes and minutes (ticket 49c).
  if (report.pmReport) return <PmReportCard report={report.pmReport} names={names} />;
  const rows = [
    ...fact(t('report.problem'), report.problem),
    ...fact(t('report.observedBy'), report.observedBy),
    ...fact(t('report.correctiveAction'), report.correctiveAction),
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
    ...fact(t('report.rootCause'), report.rootCause),
    ...fact(t('report.handoverTo'), report.handoverName),
    ...fact(t('report.date'), report.date),
    ...fact(t('report.shift'), report.shiftCode),
  ];
  return (
    <Stack gap={2}>
      <SectionTitle>{t('report.title')}</SectionTitle>
      <FactList rows={rows} />
    </Stack>
  );
}
