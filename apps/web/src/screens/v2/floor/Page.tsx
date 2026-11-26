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
import { CancelSheetView, DisputeSheetView, MineView, PmJobsView } from './ListsView.js';
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
  const ticket = list.rows.find((row) => row.id === sheet?.ticketId);
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
  const sheetOn = (send: () => void) => ({
    open: sheet !== null,
    onOpenChange: (next: boolean) => (next ? undefined : close()),
    reason: setReason,
    send,
  });
  const mine = mineModel(
    list.rows,
    {
      ...list.ctx,
      me: data.me,
      machines: data.config.machines,
      // The ask's refusal note stays quiet while the Not fixed sheet shows it.
      answer:
        answered && sheet?.kind !== 'dispute' ? { ...answered, pending: command.pending } : null,
    },
    t,
  );
  return (
    <>
      <MineView
        model={mine}
        on={{
          more: list.more,
          retry: list.retry,
          cancel: (ticketId) => open({ kind: 'cancel', ticketId }),
          yes: (ticketId) => void answer(ticketId, 'confirmed'),
          no: (ticketId) => {
            setAnswered(null);
            open({ kind: 'dispute', ticketId });
          },
        }}
      />
      {ticket && sheet?.kind === 'dispute' ? (
        <DisputeSheetView
          model={disputeModel(
            ticket,
            {
              reason,
              refusal: answered?.ticketId === ticket.id ? answered.refusal : null,
              pending: command.pending,
            },
            t,
          )}
          on={sheetOn(() => void answer(ticket.id, 'disputed', reason.trim()))}
        />
      ) : null}
      {ticket && sheet?.kind === 'cancel' ? (
        <CancelSheetView
          model={cancelModel(ticket, { reason, error: command.error, pending: command.pending }, t)}
          on={sheetOn(() => void cancel(ticket.id))}
        />
      ) : null}
    </>
  );
}

function PmList({ data }: { data: FloorData }) {
  const { t } = useTranslation();
  const list = useListState(
    // eslint-disable-next-line i18next/no-literal-string -- query values, not copy
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
