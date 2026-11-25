import type { TFunction } from 'i18next';
import { pendingTasksOn } from '@uptimo/shared/tasks';
import type { Group, Machine, Ticket } from '../../../api.js';
import {
  groupExample,
  groupMachines,
  rowStatus,
  searchMachines,
  sections,
} from '../../../faces/floor/machines.js';
import { clock, FLOOR, type FloorData } from '../../../faces/floor/use-floor.js';
import {
  currentTab,
  floorTabKeys,
  otherWorkReady,
  reporterName,
  rowOpens,
  sendReady,
  startStep,
  ticketPlace,
  type BrowseModel,
  type GroupStepModel,
  type MachineRowModel,
  type OtherWorkForm,
  type OtherWorkModel,
  type ProblemModel,
  type ReportModel,
  type SentModel,
  type SituationModel,
  type TabsModel,
  type TicketFactsModel,
  type WhoModel,
} from './model.js';

/**
 * The floor's data (v1 `useFloorData`) and the report in progress (v1 `useReport` state) → the models the View draws.
 * Every word through `t`, v1's keys unchanged (`floor.*`, `reportFloor.*`, `tasks.warning*`, `pm.jobs.tab`).
 */

/** The report in progress, as `useReport` and `readRecent()` hold it in Page.tsx. */
export type ReportInput = {
  query: string;
  group: Group | null;
  machine: Machine | null;
  kind: 'stopped' | 'support';
  problem: string;
  startNow: boolean;
  sheet: Ticket | null;
  sent: Ticket | null;
  /** `readRecent()`: machine ids, newest first. */
  recent: string[];
};

/** Other work in progress. */
export type OtherWorkInput = { form: OtherWorkForm; startNow: boolean; sent: Ticket | null };

/** The tab bar for a login (`maintenance` undefined while the login loads) on a path. */
export function tabsModel(
  maintenance: boolean | undefined,
  pathname: string,
  t: TFunction,
): TabsModel {
  const labels = {
    report: { to: FLOOR.report, label: t('nav.report') },
    mine: { to: FLOOR.mine, label: t('floor.complaints') },
    pm: { to: FLOOR.pm, label: t('pm.jobs.tab') },
  };
  return {
    label: t('reportFloor.tabs'),
    tabs: floorTabKeys(maintenance).map((key) => ({ key, ...labels[key] })),
    current: currentTab(pathname),
  };
}

/** "group name (else category) · cell", the line under a machine's code. */
function machineDetail(data: FloorData, machine: Machine): string {
  const group = data.config.groups.find((g) => g.id === machine.group_id);
  return [group?.name ?? machine.category, machine.cell].filter(Boolean).join(' · ');
}

/** One machine row with its open ticket's status and detail (v1 `machine-row.tsx`). */
export function machineRow(data: FloorData, machine: Machine, t: TFunction): MachineRowModel {
  const ticket = data.open.get(machine.id);
  const detail = ticket
    ? t(ticket.kind === 'support' ? 'reportFloor.needsSupport' : 'reportFloor.alreadyReported')
    : machineDetail(data, machine);
  return {
    ...{ id: machine.id, code: machine.code, detail },
    ...{ status: rowStatus(ticket), opens: rowOpens(ticket) },
  };
}

/** A ticket's facts card (v1 `sent.tsx` `TicketFacts`). */
export function ticketFacts(data: FloorData, ticket: Ticket, t: TFunction): TicketFactsModel {
  return {
    place: ticketPlace(data, ticket),
    status: rowStatus(ticket),
    number: t('reportFloor.ticketNumber', { ref: ticket.ref }),
    problem: ticket.problem,
    reported: t('reportFloor.reportedBy', {
      time: clock(ticket.reportedAt),
      who: reporterName(data, ticket),
    }),
  };
}

function whoModel(data: FloorData, startNow: boolean, t: TFunction): WhoModel {
  return data.maintenance
    ? { kind: 'startNow', label: t('reportFloor.startNow'), checked: startNow }
    : { kind: 'reportingAs', text: t('reportFloor.reportingAs', { who: data.who }) };
}

function sentModel(data: FloorData, ticket: Ticket, t: TFunction): SentModel {
  return {
    title: t('reportFloor.sent'),
    onLive:
      ticket.kind === 'stopped'
        ? t('reportFloor.onLive', { code: ticketPlace(data, ticket) })
        : null,
    facts: ticketFacts(data, ticket, t),
    another: t('reportFloor.another'),
    seeMine: t('reportFloor.seeMine'),
  };
}

function browseModel(data: FloorData, input: ReportInput, t: TFunction): BrowseModel {
  const { machines } = data.config;
  const typing = input.query.trim() !== '';
  const found = searchMachines(machines, input.query);
  const count = (n: number) =>
    n === 1 ? t('reportFloor.oneMachine') : t('reportFloor.machines', { count: n });
  return {
    kind: 'browse',
    title: t('floor.whichMachine'),
    hint: t('reportFloor.hint'),
    findLabel: t('reportFloor.find'),
    findPlaceholder: t('reportFloor.findPlaceholder'),
    query: input.query,
    recentLabel: t('reportFloor.recent'),
    recent: typing
      ? []
      : input.recent
          .map((id) => machines.find((m) => m.id === id))
          .filter((m): m is Machine => Boolean(m))
          .slice(0, 3)
          .map((m) => ({ id: m.id, code: m.code })),
    other: typing ? null : { title: t('reportFloor.other'), detail: t('reportFloor.otherDetail') },
    segments: typing
      ? []
      : sections(data.config).map((s) => ({
          id: s.segment.id,
          title: s.segment.name,
          count: s.count,
          groups: s.groups.map(({ group, count: n }) => ({
            ...{ id: group.id, code: group.code, name: group.name, count: count(n) },
          })),
        })),
    rows: found.map((m) => machineRow(data, m, t)),
    noMatch: typing && found.length === 0 ? t('reportFloor.noMatch', { q: input.query }) : null,
  };
}

function groupModel(data: FloorData, group: Group, query: string, t: TFunction): GroupStepModel {
  const all = data.config.machines;
  const example = groupExample(groupMachines(all, group, ''), group);
  return {
    kind: 'group',
    title: `${group.code} ${group.name}`,
    back: t('reportFloor.groups'),
    idLabel: t('reportFloor.machineId'),
    placeholder: t('reportFloor.groupPlaceholder', example),
    hint: t('reportFloor.groupHint', example),
    query,
    rows: groupMachines(all, group, query).map((m) => machineRow(data, m, t)),
  };
}

function situationModel(
  data: FloorData,
  machine: Machine,
  support: Ticket | undefined,
  t: TFunction,
): SituationModel {
  const reasons: Record<string, string> = {};
  for (const item of data.config.lists.task_reason ?? []) reasons[item.code] = item.label;
  const pending = pendingTasksOn(data.openAll, machine.id);
  const ref = support?.ref ?? '';
  return {
    title: t(support ? 'reportFloor.situationNow' : 'reportFloor.situation'),
    back: t('reportFloor.machine'),
    machine: {
      label: t('reportFloor.machine'),
      code: machine.code,
      detail: machineDetail(data, machine),
    },
    support: support
      ? { title: t('reportFloor.kindSupport'), text: t('reportFloor.supportTicket', { ref }) }
      : null,
    tasks:
      pending.length > 0
        ? {
            title: t('tasks.warningTitle'),
            lines: pending.map((task) =>
              t(task.taskExpectedOn ? 'tasks.warningBody' : 'tasks.warningBodyNoDate', {
                ref: task.ref,
                reason: task.taskReason ? (reasons[task.taskReason] ?? task.taskReason) : '—',
                date: task.taskExpectedOn ?? '',
              }),
            ),
          }
        : null,
    stopped: {
      title: t('reportFloor.stopped'),
      detail: t(support ? 'reportFloor.upgradeDetail' : 'reportFloor.stoppedDetail', { ref }),
    },
    running: {
      title: t(support ? 'reportFloor.stillSupport' : 'reportFloor.support'),
      detail: t(support ? 'reportFloor.stillSupportDetail' : 'reportFloor.supportDetail', { ref }),
    },
    runningOpensSheet: Boolean(support),
  };
}

function problemModel(
  data: FloorData,
  input: ReportInput,
  support: Ticket | undefined,
  t: TFunction,
): ProblemModel {
  const upgrade = Boolean(support) && input.kind === 'stopped';
  const quick = (data.config.lists.quick_problem ?? []).filter((item) => item.active);
  return {
    title: t('floor.problem'),
    back: t('reportFloor.type'),
    code: input.machine?.code ?? '',
    kind: input.kind,
    upgradeText: upgrade ? (support?.problem ?? '') : null,
    label: t('floor.problem'),
    placeholder: t('reportFloor.problemPlaceholder'),
    problem: input.problem,
    chips: quick.map((item) => ({
      id: item.id,
      label: item.label,
      pressed: input.problem === item.label,
    })),
    who: whoModel(data, input.startNow, t),
    action: t(input.kind === 'stopped' ? 'reportFloor.sendStopped' : 'reportFloor.sendSupport'),
    ready: sendReady(upgrade, input.problem),
  };
}

/** The report flow: Step 1 (browse or group), Step 2, Step 3, Sent and the ticket sheet (v1 `report.tsx` + steps). */
export function reportModel(data: FloorData, input: ReportInput, t: TFunction): ReportModel {
  const { machine } = input;
  const existing = machine ? data.open.get(machine.id) : undefined;
  const support = existing?.kind === 'support' ? existing : undefined;
  return {
    title: t('floor.title'),
    start: startStep(machine),
    machine: input.group
      ? groupModel(data, input.group, input.query, t)
      : browseModel(data, input, t),
    situation: machine ? situationModel(data, machine, support, t) : null,
    problem: problemModel(data, input, support, t),
    sent: input.sent ? sentModel(data, input.sent, t) : null,
    sheet: input.sheet
      ? {
          title: ticketPlace(data, input.sheet),
          facts: ticketFacts(data, input.sheet, t),
          started: input.sheet.startedAt
            ? t('reportFloor.workStarted', { time: clock(input.sheet.startedAt) })
            : t('reportFloor.notStarted'),
        }
      : null,
  };
}

/** Other work (v1 `other-work.tsx` + `other-work-fields.tsx`). */
export function otherWorkModel(
  data: FloorData,
  input: OtherWorkInput,
  t: TFunction,
): OtherWorkModel {
  const places = [
    ...new Set(data.config.machines.map((m) => m.cell).filter((c): c is string => Boolean(c))),
  ];
  const types = (data.config.lists.work_type ?? []).filter((item) => item.active);
  return {
    title: t('floor.title'),
    stepTitle: t('reportFloor.other'),
    aside: t('floor.workRequest'),
    back: t('nav.report'),
    intro: t('reportFloor.otherIntro'),
    where: {
      label: t('floor.where'),
      choose: t('reportFloor.selectPlace'),
      places,
      typedLabel: t('reportFloor.typePlace'),
    },
    workType: {
      label: t('reportFloor.workType'),
      choose: t('reportFloor.selectWork'),
      types: types.map((item) => item.label),
    },
    needed: { label: t('reportFloor.needed'), placeholder: t('reportFloor.neededPlaceholder') },
    urgency: {
      label: t('reportFloor.urgency'),
      normal: t('reportFloor.normal'),
      urgent: t('reportFloor.urgent'),
    },
    form: input.form,
    who: whoModel(data, input.startNow, t),
    action: t('reportFloor.sendWork'),
    ready: otherWorkReady(input.form),
    sent: input.sent ? sentModel(data, input.sent, t) : null,
  };
}
