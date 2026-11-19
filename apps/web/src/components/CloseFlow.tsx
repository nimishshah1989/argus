import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommandAction, CommandBody, Config, TicketDetail } from '../api.js';
import { Banner } from '../ui/banner.js';
import { Button } from '../ui/button.js';
import { FinishTime, ScreenFooter } from '../ui/close-kit.js';
import { FactList, MinuteTiles } from '../ui/detail-kit.js';
import { TopBar } from '../ui/top-bar.js';
import { closeAt, earliestFinish, finishFigures, stepFinish, STEP_MIN } from './closeFinish.js';
import { NO_TASK, TaskLeaveCard, taskInput, taskReady, type TaskDraft } from './FollowUpTask.js';
import { PmClose } from './PmClose.js';
import { formatClock, formatMinutes, machineLabel } from './format.js';
import { Classification, WhatHappened, WhoDidIt } from './ReportSections.js';
import { StatusBadge } from './StatusBadge.js';
import {
  buildReportBody,
  initialReportValues,
  reportReady,
  type ReportValues,
} from './reportFields.js';

export interface CloseFlowProps {
  detail: TicketDetail;
  config: Config;
  personId: string;
  /** `close` writes the report and closes; `late` files the report of a ticket closed without one. */
  mode: 'close' | 'late';
  pending: boolean;
  error: string | null;
  command: (action: CommandAction, body: CommandBody) => Promise<boolean>;
  onExit: () => void;
}

/** The machine, its status chip and the three facts the finish time is judged against. */
function TicketFacts(props: CloseFlowProps & { responseMin: number | null }) {
  const { t } = useTranslation();
  const { ticket } = props.detail;
  const zone = props.config.timeZone;
  const started = ticket.startedAt
    ? t('closes.workStarted', {
        time: formatClock(ticket.startedAt, zone),
        response: formatMinutes(props.responseMin),
      })
    : '—';
  return (
    <>
      <section className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 shadow-card">
        <h2 className="text-title1 font-extrabold leading-tight">
          {machineLabel(ticket, props.config.machines)}
        </h2>
        <StatusBadge status={ticket.status} handedOver={ticket.handedOver} />
      </section>
      <FactList
        rows={[
          { label: t('closes.fact.reported'), value: formatClock(ticket.reportedAt, zone) },
          { label: t('closes.fact.workStarted'), value: started },
          { label: t('closes.fact.waiting'), value: formatMinutes(ticket.figures?.waitMin ?? 0) },
        ]}
      />
    </>
  );
}

/** Step 1: when did you finish, and what that does to the figures. */
function FinishStep(props: CloseFlowProps & { onNext: (finish: Date, openedAt: Date) => void }) {
  const { t } = useTranslation();
  const { detail, config } = props;
  const [now] = useState(() => new Date());
  const floor = new Date(Math.min(earliestFinish(detail).getTime(), now.getTime()));
  const [finish, setFinish] = useState(now);
  const zone = config.timeZone;
  const figs = finishFigures(detail, finish);
  const step = (minutes: number) => setFinish(stepFinish(finish, minutes, floor, now));
  const behind = Math.round((now.getTime() - finish.getTime()) / 60_000);
  return (
    <>
      <TopBar
        back={{ onClick: props.onExit, label: t('common.back') }}
        trailing={<h1 className="text-footnote text-neutral-600">{t('closes.step1.title')}</h1>}
      />
      <main className="flex flex-1 flex-col gap-4 p-4">
        <TicketFacts {...props} responseMin={figs.responseMin} />
        <FinishTime
          title={t('closes.finish.title')}
          label={t('closes.finish.label')}
          time={formatClock(finish.toISOString(), zone)}
          status={
            behind <= 0
              ? t('closes.finish.now')
              : t('closes.finish.ago', { time: formatMinutes(behind) })
          }
          hint={t('closes.finish.hint')}
          earlier={t('closes.finish.earlier')}
          now={t('closes.finish.now')}
          later={t('closes.finish.later')}
          canEarlier={finish > floor}
          canNow={finish < now}
          isNow={finish >= now}
          canLater={finish < now}
          onEarlier={() => step(-STEP_MIN)}
          onNow={() => setFinish(now)}
          onLater={() => step(STEP_MIN)}
        />
        <MinuteTiles
          tiles={[
            { label: t('closes.tile.response'), value: formatMinutes(figs.responseMin) },
            { label: t('closes.tile.repair'), value: formatMinutes(figs.repairMin) },
            { label: t('closes.tile.downtime'), value: formatMinutes(figs.downtimeMin) },
          ]}
        />
      </main>
      <ScreenFooter hint={t('closes.step1.hint')}>
        <Button onClick={() => props.onNext(finish, now)}>{t('closes.step1.next')}</Button>
      </ScreenFooter>
    </>
  );
}

/** The finish chosen on step 1 and the moment that screen opened. */
interface Opened {
  at: Date;
  openedAt: Date;
}

/** A close dated at the chosen finish, or the late report of a closed ticket. A close may leave a task. */
function sendReport(
  props: CloseFlowProps,
  values: ReportValues,
  finish: Opened | null,
  task: TaskDraft,
) {
  const report = buildReportBody(values);
  if (props.mode === 'late') return props.command('report', { report });
  const left = taskInput(task);
  return props.command('close', {
    kind: 'report',
    at: (finish ? closeAt(finish.at, finish.openedAt, new Date()) : new Date()).toISOString(),
    report,
    ...(left ? { task: left } : {}),
  });
}

/** Step 2 (or the only step of a late report): the breakdown report form and its one primary button. */
function ReportStep(
  props: CloseFlowProps & {
    values: ReportValues;
    finish: Opened | null;
    onBack: () => void;
    setValues: (values: ReportValues) => void;
    task: TaskDraft;
    setTask: (task: TaskDraft) => void;
  },
) {
  const { t } = useTranslation();
  const { values, finish } = props;
  const late = props.mode === 'late';
  const machineCode = machineLabel(props.detail.ticket, props.config.machines);
  const fields = {
    values,
    config: props.config,
    update: (patch: Partial<ReportValues>) => props.setValues({ ...values, ...patch }),
  };

  const canSend = !props.pending && reportReady(values) && taskReady(props.task);

  async function submit() {
    if (!canSend) return;
    if (await sendReport(props, values, finish, props.task)) props.onExit();
  }
  const submitLabel = late ? t('closes.late.submit') : t('report.closeWithReport');

  return (
    <form
      aria-label={t('closes.reportTitle')}
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <TopBar
        back={{ onClick: props.onBack, label: t('common.back') }}
        trailing={<h1 className="text-footnote text-neutral-600">{t('closes.reportTitle')}</h1>}
      />
      <main className="flex flex-1 flex-col gap-4 p-4">
        {late ? (
          <Banner tone="info" title={t('closes.late.title')}>
            {t('closes.late.note')}
          </Banner>
        ) : null}
        <WhatHappened {...fields} machineCode={machineCode} />
        <WhoDidIt {...fields} />
        <Classification {...fields} />
        {late ? null : (
          <TaskLeaveCard config={props.config} draft={props.task} onChange={props.setTask} />
        )}
        {props.error ? <Banner tone="error" title={props.error} /> : null}
      </main>
      <ScreenFooter hint={late ? t('closes.form.hintLate') : t('closes.form.hintClose')}>
        <Button type="submit" disabled={!canSend}>
          {props.pending ? t('common.saving') : submitLabel}
        </Button>
      </ScreenFooter>
    </form>
  );
}

/** The two full screens of Write report and close, or the late report's one (design lock, slice 2). */
export function CloseFlow(props: CloseFlowProps) {
  // A PM job closes on its plan's checklist: no finish step and no breakdown report (ticket 49c, R8).
  if (props.detail.ticket.raisedChannel === 'pm') return <PmClose {...props} />;
  return <CloseScreens {...props} />;
}

/** The breakdown close's own two screens. */
function CloseScreens(props: CloseFlowProps) {
  const [step, setStep] = useState<1 | 2>(props.mode === 'late' ? 2 : 1);
  const [finish, setFinish] = useState<Opened | null>(null);
  const [task, setTask] = useState<TaskDraft>(NO_TASK);
  const [values, setValues] = useState<ReportValues | null>(() =>
    props.mode === 'late'
      ? initialReportValues(
          props.detail.ticket,
          props.config,
          undefined,
          props.detail.ticket.closedAt ? new Date(props.detail.ticket.closedAt) : undefined,
        )
      : null,
  );
  function next(chosen: Date, openedAt: Date) {
    const fresh = initialReportValues(
      props.detail.ticket,
      props.config,
      finishFigures(props.detail, chosen),
      chosen,
    );
    setFinish({ at: chosen, openedAt });
    setValues((prev) =>
      prev
        ? {
            ...prev,
            downtimeMin: fresh.downtimeMin,
            responseMin: fresh.responseMin,
            repairMin: fresh.repairMin,
            date: fresh.date,
            shiftCode: fresh.shiftCode,
          }
        : fresh,
    );
    setStep(2);
  }
  // Each screen opens at its top, not where the ticket detail was scrolled to.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-100">
      {step === 1 || !values ? (
        <FinishStep {...props} onNext={next} />
      ) : (
        <ReportStep
          {...props}
          values={values}
          setValues={setValues}
          finish={finish}
          task={task}
          setTask={setTask}
          onBack={props.mode === 'late' ? props.onExit : () => setStep(1)}
        />
      )}
    </div>
  );
}
