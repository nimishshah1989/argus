import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { raiseTicket, tickets, type Ticket } from '../../../api.js';
import { signoffRefusal, type Refusal } from '../../../components/signoff.js';
import { useCommand, useOnline } from '../../../data/index.js';
import { startsNow, useReport } from '../../../faces/floor/report-state.js';
import { FLOOR, readRecent, useFloorData, type FloorData } from '../../../faces/floor/use-floor.js';
import { viewState } from '../../../patterns/view-state.js';
import { otherWorkModel, reportModel, tabsModel } from './adapter.js';
import {
  cancelModel,
  disputeModel,
  mineModel,
  pmModel,
  type ListsContext,
} from './lists-adapter.js';
import { EMPTY_OTHER_WORK, floorWaiting, otherWorkLocation, type OtherWorkForm } from './model.js';
import {
  CancelSheetView,
  DisputeSheetView,
  MineView,
  PmJobsView,
  type SheetActions,
} from './ListsView.js';
import { FloorFrame, FloorWaitingView, OtherWorkView, ReportView } from './View.js';

/**
 * The live wiring (ADR 0045 T1): v1's `useFloorData` (config, state, me; retry), v1's `useReport` (reused as is:
 * pick, upgrade-kind, raise, 409 → the open breakdown's sheet, refresh `state` + `tickets`), `readRecent()`,
 * `useOnline()`, the router. Draws `FloorFrame` around `ReportView` / `OtherWorkView`, or `FloorWaitingView`.
 */

/** The report flow once the plant is in; `key` restarts it fresh. */
function ReportFlow(p: { data: FloorData; deepLink: string | null; onAnother: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = p;
  const report = useReport(data, p.deepLink);
  const model = reportModel(data, { ...report, recent: readRecent() }, t);
  const machineById = (id: string) => data.config.machines.find((m) => m.id === id);
  const chooseKind = (kind: 'stopped' | 'support', next: () => void) => {
    report.setKind(kind);
    next();
  };
  const onStopped = (next: () => void) => chooseKind('stopped', next);
  const onSupport = (next: () => void) => chooseKind('support', next);
  return (
    <ReportView
      model={model}
      on={{
        onQuery: report.setQuery,
        onGroup: (id) => {
          report.setGroup(data.config.groups.find((g) => g.id === id) ?? null);
          report.setQuery('');
        },
        onPick: (id, next) => {
          const machine = machineById(id);
          if (machine) report.pick(machine, next);
        },
        onOther: () => navigate(FLOOR.other),
        onStopped,
        onRunning: (next) => {
          if (report.supportTicket) return report.setSheet(report.supportTicket);
          onSupport(next);
        },
        onProblem: report.setProblem,
        onStartNow: report.setStartNow,
        onSend: report.send,
        onCloseSheet: () => report.setSheet(null),
        onAnother: p.onAnother,
        onMine: () => navigate(FLOOR.mine),
      }}
    />
  );
}

/** `/floor`: the report flow. `?m=CODE` opens Step 2 once; "Report another machine" starts a fresh flow without it. */
export function FloorReportPage(): ReactNode {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [round, setRound] = useState(0);
  const online = useOnline();
  const load = useFloorData();
  const { data } = load;
  return (
    <FloorFrame tabs={tabsModel(data?.maintenance, pathname, t)}>
      {data ? (
        <ReportFlow
          key={round}
          data={data}
          deepLink={round === 0 ? params.get(FLOOR.machine) : null}
          onAnother={() => setRound((n) => n + 1)}
        />
      ) : (
        <FloorWaitingView
          title={t('floor.title')}
          state={floorWaiting(load.error, online)}
          onRetry={load.retry}
        />
      )}
    </FloorFrame>
  );
}

function OtherFlow({ data }: { data: FloorData }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OtherWorkForm>(EMPTY_OTHER_WORK);
  const [startNow, setStartNow] = useState(false);
  const [sent, setSent] = useState<Ticket | null>(null);
  async function send(): Promise<void> {
    const reply = await raiseTicket({
      ...{ kind: 'general', location: otherWorkLocation(form), workType: form.workType },
      problem: form.needed.trim(),
      urgent: form.urgent,
      startNow: startsNow(data.maintenance, startNow),
    });
    setSent(reply.ticket);
    await queryClient.invalidateQueries({ queryKey: ['tickets'] });
  }
  return (
    <OtherWorkView
      model={otherWorkModel(data, { form, startNow, sent }, t)}
      on={{
        onForm: (patch) => setForm((f) => ({ ...f, ...patch })),
        onStartNow: setStartNow,
        onBack: () => navigate(FLOOR.report),
        onSend: send,
        onAnother: () => navigate(FLOOR.report),
        onMine: () => navigate(FLOOR.mine),
      }}
    />
  );
}

/** The list query's rows and paging, drawn through `viewState` as v1 `QueuePage` did. */
function useListState(list: ReturnType<typeof tickets.useList>, online: boolean) {
  const rows = list.data?.pages.flatMap((page) => page.items) ?? [];
  const ctx: Pick<ListsContext, 'state' | 'paging' | 'nowIso'> = {
    state: viewState({
      online,
      hasData: list.data !== undefined,
      isEmpty: rows.length === 0,
      error: list.error,
    }),
    paging: { hasNext: Boolean(list.hasNextPage), fetching: list.isFetchingNextPage },
    nowIso: new Date().toISOString(),
  };
  return { rows, ctx, more: () => void list.fetchNextPage(), retry: () => void list.refetch() };
}

type OpenSheet = { kind: 'dispute' | 'cancel'; ticketId: string } | null;

const CONFIRMED = 'confirmed';
const DISPUTED = 'disputed';
const CANCEL = 'cancel';
const DISPUTE = 'dispute';

type SheetsProps = {
  rows: Ticket[];
  sheet: OpenSheet;
  reason: string;
  answered: { ticketId: string; refusal: Refusal | null } | null;
  command: ReturnType<typeof useCommand>;
  onClose: () => void;
  onReason: (text: string) => void;
  onDispute: (ticket: Ticket) => void;
  onCancel: (ticket: Ticket) => void;
};

/** The one open sheet, if any. */
function MineSheets(p: SheetsProps) {
  const { t } = useTranslation();
  const { sheet, command } = p;
  const ticket = p.rows.find((row) => row.id === sheet?.ticketId);
  if (!ticket) return null;
  const on = (send: () => void): SheetActions => ({
    open: true,
    onOpenChange: (next) => (next ? undefined : p.onClose()),
    reason: p.onReason,
    send,
  });
  if (sheet?.kind === DISPUTE) {
    const refusal = p.answered?.ticketId === ticket.id ? p.answered.refusal : null;
    const input = { reason: p.reason, refusal, pending: command.pending };
    return (
      <DisputeSheetView model={disputeModel(ticket, input, t)} on={on(() => p.onDispute(ticket))} />
    );
  }
  if (sheet?.kind !== CANCEL) return null;
  const input = { reason: p.reason, error: command.error, pending: command.pending };
  return (
    <CancelSheetView model={cancelModel(ticket, input, t)} on={on(() => p.onCancel(ticket))} />
  );
}

/** My complaints: the list, the answer to "Is it fixed?", and the two sheets (one open at a time). */
function MineList({ data }: { data: FloorData }) {
  const { t } = useTranslation();
  const command = useCommand();
  const list = useListState(tickets.useList({ raisedBy: data.me.actingPersonId }), useOnline());
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [reason, setReason] = useState('');
  const [answered, setAnswered] = useState<{ ticketId: string; refusal: Refusal | null } | null>(
    null,
  );
  const open = (next: OpenSheet) => {
    setReason('');
    setSheet(next);
  };
  const close = () => open(null);

  async function answer(ticketId: string, response: 'confirmed' | 'disputed', why?: string) {
    setAnswered({ ticketId, refusal: null });
    const body = { personId: data.me.actingPersonId, response, ...(why ? { reason: why } : {}) };
    if (await command.run(ticketId, 'handback', body)) close();
    else setAnswered({ ticketId, refusal: signoffRefusal(command.failure(), response) });
  }
  async function cancel(ticketId: string) {
    if (await command.run(ticketId, 'cancel', { reason: reason.trim() })) close();
  }
  // The ask's refusal note stays quiet while the Not fixed sheet shows it.
  const answer_ =
    answered && sheet?.kind !== DISPUTE ? { ...answered, pending: command.pending } : null;
  const ctx = { ...list.ctx, me: data.me, machines: data.config.machines, answer: answer_ };
  return (
    <>
      <MineView
        model={mineModel(list.rows, ctx, t)}
        on={{
          more: list.more,
          retry: list.retry,
          cancel: (ticketId) => open({ kind: CANCEL, ticketId }),
          yes: (ticketId) => void answer(ticketId, CONFIRMED),
          no: (ticketId) => {
            setAnswered(null);
            open({ kind: DISPUTE, ticketId });
          },
        }}
      />
      <MineSheets
        rows={list.rows}
        sheet={sheet}
        reason={reason}
        answered={answered}
        command={command}
        onClose={close}
        onReason={setReason}
        onDispute={(row) => void answer(row.id, DISPUTED, reason.trim())}
        onCancel={(row) => void cancel(row.id)}
      />
    </>
  );
}

function PmList({ data }: { data: FloorData }) {
  const { t } = useTranslation();
  const list = useListState(
    tickets.useList({ channel: ['pm'], status: ['open', 'working'] }),
    useOnline(),
  );
  const model = pmModel(list.rows, { ...list.ctx, me: data.me, machines: data.config.machines }, t);
  return <PmJobsView model={model} on={{ more: list.more, retry: list.retry }} />;
}

/** `/floor/mine`: what this person reported (`raisedBy` = the acting person), with sign-off and cancel. */
export function FloorMinePage(): ReactNode {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const online = useOnline();
  const load = useFloorData();
  const { data } = load;
  return (
    <FloorFrame tabs={tabsModel(data?.maintenance, pathname, t)}>
      {data ? (
        <MineList data={data} />
      ) : (
        <FloorWaitingView
          title={t('floor.complaints')}
          state={floorWaiting(load.error, online)}
          onRetry={load.retry}
        />
      )}
    </FloorFrame>
  );
}

/** `/floor/pm`: the open PM jobs, each a link to its ticket. */
export function FloorPmPage(): ReactNode {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const online = useOnline();
  const load = useFloorData();
  const { data } = load;
  return (
    <FloorFrame tabs={tabsModel(data?.maintenance, pathname, t)}>
      {data ? (
        <PmList data={data} />
      ) : (
        <FloorWaitingView
          title={t('pm.jobs.title')}
          state={floorWaiting(load.error, online)}
          onRetry={load.retry}
        />
      )}
    </FloorFrame>
  );
}

/** `/floor/other`: a work request (`raiseTicket` kind `general`; invalidates `tickets`). */
export function FloorOtherPage(): ReactNode {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const online = useOnline();
  const load = useFloorData();
  const { data } = load;
  return (
    <FloorFrame tabs={tabsModel(data?.maintenance, pathname, t)}>
      {data ? (
        <OtherFlow data={data} />
      ) : (
        <FloorWaitingView
          title={t('floor.title')}
          state={floorWaiting(load.error, online)}
          onRetry={load.retry}
        />
      )}
    </FloorFrame>
  );
}
