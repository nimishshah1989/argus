import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../data/index.js';
import { Button } from '../ui/button.js';
import { Stack } from '../ui/layout.js';
import { PatternFrame } from './frame.js';
import { offlineNotice } from './view-state.js';

export interface WizardStep {
  title: string;
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
export interface WizardPageProps {
  title: string;
  /** In order; the last step's action finishes. */
  steps: WizardStep[];
  offlineAllowed: boolean;
  /** A throw shows kit.wizard.error and stays on the last step; `false` stays without an error. */
  onFinish: () => Promise<void | false>;
  /** Header text in place of "Step n of total" (a one-step flow names itself). */
  aside?: string;
  /** The step to open on (a deep link). */
  start?: number;
  /** Shown alone once onFinish resolves. */
  result: ReactNode;
}

function useWizardFlow(p: WizardPageProps) {
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

/** The offline notice, the send error and the step's one primary button. */
function StepFooter(p: {
  step: WizardStep;
  notice: ReturnType<typeof offlineNotice>;
  failed: boolean;
  pending: boolean;
  primary: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const { step, notice, pending } = p;
  return (
    <>
      {notice ? (
        <p role="status" className="text-footnote text-neutral-600">
          {t(notice)}
        </p>
      ) : null}
      {p.failed ? (
        <p role="alert" className="text-body font-medium text-neutral-900">
          {t('kit.wizard.error')}
        </p>
      ) : null}
      {step.action ? (
        <div className="flex flex-col">
          <Button
            disabled={!step.ready || pending || notice === 'kit.form.needsConnection'}
            onClick={() => void p.primary()}
          >
            {pending ? t('common.sending') : step.action}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/** A short flow: one primary action per step, a header back, a result screen. */
export function WizardPage(p: WizardPageProps) {
  const { t } = useTranslation();
  const online = useOnline();
  const w = useWizardFlow(p);
  const { index, pending, done } = w;
  const { title, steps } = p;
  const step = steps[index]!;
  const notice = w.last ? offlineNotice(online, p.offlineAllowed) : null;
  const canBack = (index > 0 || step.onBack) && !pending;

  if (done)
    return (
      <PatternFrame title={title}>
        <div ref={w.resultBox} tabIndex={-1}>
          {p.result}
        </div>
      </PatternFrame>
    );
  return (
    <PatternFrame
      title={title}
      back={canBack ? { label: step.back ?? t('common.back'), onClick: w.back } : undefined}
      aside={p.aside ?? t('kit.wizard.step', { n: index + 1, total: steps.length })}
    >
      <Stack gap={4}>
        {step.lead}
        <h3 ref={w.stepHeading} tabIndex={-1} className="text-title2 font-bold">
          {step.title}
        </h3>
        {typeof step.body === 'function' ? step.body(() => void w.primary()) : step.body}
        <StepFooter
          step={step}
          notice={notice}
          failed={w.failed}
          pending={pending}
          primary={w.primary}
        />
      </Stack>
    </PatternFrame>
  );
}
