import { useTranslation } from 'react-i18next';
import type { LockoutStep } from '@uptimo/shared/lockout';
import { Banner } from '../ui/banner.js';
import { CircleX, Lock } from '../ui/icon.js';
import { Stack } from '../ui/layout.js';
import { TickRow } from '../ui/tick-row.js';
import { formatTime } from './format.js';
import { useLockoutGate, type Gate } from './LockoutGate.js';
import { LockoutChip } from './LockoutChip.js';
import { localisedLabel } from './lockout.js';

interface Props {
  names: Record<string, string>;
  timeZone?: string;
}

function useLabel() {
  const { i18n } = useTranslation();
  return (step: LockoutStep) => localisedLabel(step, i18n.language);
}

function Ticking({ gate, steps }: { gate: Gate; steps: LockoutStep[] }) {
  const { t } = useTranslation();
  const label = useLabel();
  const done = steps.filter((step) => gate.ticks.has(step.code)).length;
  return (
    <>
      {gate.refusal && (
        <Banner tone="error" icon={CircleX} title={t('lockout.refusedTitle')}>
          {gate.refusal}
        </Banner>
      )}
      <p className="text-footnote text-neutral-600">
        {gate.busy ? t('lockout.progress', { done, total: steps.length }) : t('lockout.intro')}
      </p>
      <Stack gap={2}>
        {steps.map((step) => (
          <TickRow
            key={step.code}
            label={label(step)}
            checked={gate.ticks.has(step.code)}
            disabled={gate.busy}
            onChange={(on) => gate.tick(step.code, on)}
          />
        ))}
      </Stack>
    </>
  );
}

function Confirmed({ gate, names, timeZone }: Props & { gate: Gate }) {
  const { t } = useTranslation();
  const label = useLabel();
  const view = gate.view;
  if (view?.kind !== 'confirmed') return null;
  const name = names[view.byPersonId] ?? t('common.teamMember');
  const key = view.byPersonId === gate.personId ? 'lockout.confirmedByYou' : 'lockout.confirmedBy';
  const time = formatTime(view.at, timeZone);
  return (
    <>
      <Banner tone="ok" title={t('lockout.confirmedTitle')}>
        {t(key, { name, time, count: view.steps.length })}
      </Banner>
      <p className="text-footnote text-neutral-600">{view.steps.map(label).join(' · ')}</p>
    </>
  );
}

function Body({ gate, names, timeZone }: Props & { gate: Gate }) {
  const { t } = useTranslation();
  const view = gate.view;
  if (view?.kind === 'ticking') return <Ticking gate={gate} steps={view.steps} />;
  if (view?.kind === 'confirmed')
    return <Confirmed gate={gate} names={names} timeZone={timeZone} />;
  if (view?.kind === 'record') {
    return (
      <Banner tone="attention" title={t('lockout.recordTitle')}>
        {t('lockout.record')}
      </Banner>
    );
  }
  return (
    <Banner tone="attention" title={t('lockout.noStepsTitle')}>
      {t('lockout.noSteps')}
    </Banner>
  );
}

/** The lockout steps of a flagged ticket: ticks before Start, or who confirmed (slice 7). */
export function LockoutCard({ names, timeZone }: Props) {
  const { t } = useTranslation();
  const gate = useLockoutGate();
  if (!gate.view) return null;
  return (
    <section
      aria-label={t('lockout.title')}
      className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-body font-bold">
          <Lock aria-hidden size={20} />
          {t('lockout.title')}
        </h2>
        <LockoutChip />
      </div>
      <Body gate={gate} names={names} timeZone={timeZone} />
    </section>
  );
}
