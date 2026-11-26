import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../../data/index.js';
import { offlineNotice } from '../../patterns/view-state.js';
import { FloorPanel } from './floor-kit.js';

/** v1's `patterns/wizard-page` on the v2 kit: the same steps, focus moves, offline block and send error. */
export interface WizardStep {
  /** The step's question; omitted when the lead already says what the step is. */
  title?: string;
  /** Shown above the title (the machine the step is about). */
  lead?: ReactNode;
  /** A function gets `next()`, for a step whose own tap moves on (no primary button). */
  body: ReactNode | ((next: () => void) => ReactNode);
  /** The step's one primary action; omitted when a tap in the body moves on. */
  action?: string;
  /** Primary enabled. */
  ready?: boolean;
  /** The header's back label on this step (default "Back"). */
  back?: string;
  /** A back inside the step (e.g. out of a group); shown on the first step too. */
  onBack?: () => void;
}
export interface WizardProps {
  title: string;
  /** In order; the last step's action finishes. */
  steps: WizardStep[];
  offlineAllowed: boolean;
  /** A throw shows kit.wizard.error and stays on the last step; `false` stays without an error. */
  onFinish: () => Promise<void | false>;
  /** Header text in place of "Step n of total" (a one-step flow names itself). */
  aside?: string;
  /** Hide the sync pill while online (the floor). */
  quietOnline?: boolean;
  /** The step to open on (a deep link). */
  start?: number;
  /** Shown alone once onFinish resolves. */
  result: ReactNode;
}

function useWizardFlow(p: WizardProps) {
  const [index, setIndex] = useState(p.start ?? 0);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const moved = useRef(false);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const resultBox = useRef<HTMLDivElement>(null);
  const last = index === p.steps.length - 1;

  useEffect(() => {
    if (!moved.current) return;
    (done ? resultBox.current : stepHeading.current)?.focus();
  }, [index, done]);

  async function primary(): Promise<void> {
    moved.current = true;
    if (!last) return setIndex(index + 1);
    setPending(true);
    setFailed(false);
    try {
      if ((await p.onFinish()) !== false) setDone(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  function back(): void {
    moved.current = true;
    setFailed(false);
    const onBack = p.steps[index]?.onBack;
    if (onBack) onBack();
    else setIndex(index - 1);
  }
  return { index, last, pending, failed, done, stepHeading, resultBox, primary, back };
}

/** The primary may run: the step has one, it is ready, nothing is sending, and it may go offline. */
function canSubmit(
  step: WizardStep,
  pending: boolean,
  notice: ReturnType<typeof offlineNotice>,
): boolean {
  return Boolean(step.action && step.ready && !pending && notice !== 'kit.form.needsConnection');
}

/** The offline notice, the send error and the step's one primary button. */
function StepFooter(p: {
  step: WizardStep;
  notice: ReturnType<typeof offlineNotice>;
  failed: boolean;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const { step, notice, pending } = p;
  return (
    <>
      {notice ? (
        <p role="status" className="v2-sub">
          {t(notice)}
        </p>
      ) : null}
      {p.failed ? (
        <p role="alert" className="v2-floor-bad">
          {t('kit.wizard.error')}
        </p>
      ) : null}
      {step.action ? (
        <button
          type="submit"
          className="v2-btn v2-btn-primary v2-floor-wide"
          disabled={!canSubmit(step, pending, notice)}
        >
          {pending ? t('common.sending') : step.action}
        </button>
      ) : null}
    </>
  );
}

/** A short flow: one primary action per step, a header back, a result screen. */
export function Wizard(p: WizardProps) {
  const { t } = useTranslation();
  const online = useOnline();
  const w = useWizardFlow(p);
  const { index, pending, done } = w;
  const step = p.steps[index]!;
  const notice = w.last ? offlineNotice(online, p.offlineAllowed) : null;
  const canBack = (index > 0 || step.onBack) && !pending;

  if (done)
    return (
      <FloorPanel title={p.title} quietOnline={p.quietOnline}>
        <div ref={w.resultBox} tabIndex={-1}>
          {p.result}
        </div>
      </FloorPanel>
    );
  return (
    <FloorPanel
      title={p.title}
      quietOnline={p.quietOnline}
      back={canBack ? { label: step.back ?? t('common.back'), onClick: w.back } : undefined}
      aside={p.aside ?? t('kit.wizard.step', { n: index + 1, total: p.steps.length })}
    >
      {/* A real form: Go/Enter on the phone keyboard sends, and password managers see the fields. */}
      <form
        noValidate
        className="v2-floor-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit(step, pending, notice)) void w.primary();
        }}
      >
        {step.lead}
        {step.title ? (
          <h3 ref={w.stepHeading} tabIndex={-1} className="v2-floor-step">
            {step.title}
          </h3>
        ) : null}
        {typeof step.body === 'function' ? step.body(() => void w.primary()) : step.body}
        <StepFooter step={step} notice={notice} failed={w.failed} pending={pending} />
      </form>
    </FloorPanel>
  );
}
