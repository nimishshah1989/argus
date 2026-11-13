import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../data/index.js';
import { Button } from '../ui/button.js';
import { Inline, Stack } from '../ui/layout.js';
import { PatternFrame } from './frame.js';
import { offlineNotice } from './view-state.js';

export interface WizardStep {
  title: string;
  body: ReactNode;
  /** The step's one primary action. */
  action: string;
  /** Primary enabled. */
  ready: boolean;
}
export interface WizardPageProps {
  title: string;
  /** In order; the last step's action finishes. */
  steps: WizardStep[];
  offlineAllowed: boolean;
  /** A throw shows kit.wizard.error and stays on the last step. */
  onFinish: () => Promise<void>;
  /** Shown alone once onFinish resolves. */
  result: ReactNode;
}

function useWizardFlow(p: WizardPageProps) {
  const [index, setIndex] = useState(0);
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
      await p.onFinish();
      setDone(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  function back(): void {
    moved.current = true;
    setFailed(false);
    setIndex(index - 1);
  }
  return { index, last, pending, failed, done, stepHeading, resultBox, primary, back };
}

/** A short flow: one primary action per step, Back, a result screen. */
export function WizardPage(p: WizardPageProps) {
  const { t } = useTranslation();
  const online = useOnline();
  const w = useWizardFlow(p);
  const { index, pending, done } = w;
  const { title, steps } = p;
  const step = steps[index]!;
  const notice = w.last ? offlineNotice(online, p.offlineAllowed) : null;

  if (done)
    return (
      <PatternFrame title={title}>
        <div ref={w.resultBox} tabIndex={-1}>
          {p.result}
        </div>
      </PatternFrame>
    );
  return (
    <PatternFrame title={title}>
      <Stack gap={3}>
        <p className="text-footnote text-neutral-600">
          {t('kit.wizard.step', { n: index + 1, total: steps.length })}
        </p>
        <h3 ref={w.stepHeading} tabIndex={-1} className="text-title3 font-semibold">
          {step.title}
        </h3>
        {step.body}
        {notice ? (
          <p role="status" className="text-footnote text-neutral-600">
            {t(notice)}
          </p>
        ) : null}
        {w.failed ? (
          <p role="alert" className="text-body font-medium text-neutral-900">
            {t('kit.wizard.error')}
          </p>
        ) : null}
        <Inline gap={2}>
          {index > 0 && !pending ? (
            // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
            <Button variant="secondary" onClick={w.back}>
              {t('common.back')}
            </Button>
          ) : null}
          <Button
            disabled={!step.ready || pending || notice === 'kit.form.needsConnection'}
            onClick={() => void w.primary()}
          >
            {pending ? t('common.sending') : step.action}
          </Button>
        </Inline>
      </Stack>
    </PatternFrame>
  );
}
