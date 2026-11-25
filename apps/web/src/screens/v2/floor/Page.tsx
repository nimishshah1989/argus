import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { raiseTicket, type Ticket } from '../../../api.js';
import { useOnline } from '../../../data/index.js';
import { startsNow, useReport } from '../../../faces/floor/report-state.js';
import { FLOOR, readRecent, useFloorData, type FloorData } from '../../../faces/floor/use-floor.js';
import { otherWorkModel, reportModel, tabsModel } from './adapter.js';
import { EMPTY_OTHER_WORK, floorWaiting, otherWorkLocation, type OtherWorkForm } from './model.js';
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
