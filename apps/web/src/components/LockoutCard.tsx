import { useTranslation } from 'react-i18next';
import type { LockoutStep } from '@uptimo/shared/lockout';
import { Banner } from '../ui/banner.js';
import { CircleX, Lock } from '../ui/icon.js';
import { Stack } from '../ui/layout.js';
import { TickRow } from '../ui/tick-row.js';
import { formatTime } from './format.js';
import { useLockoutGate, type Gate } from '../screens/v2/ticket/LockoutGate.js';
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

/** The server's refusal stays on the card across the refetch, and names the crew it is still waiting for. */
function Refusal({ gate, names }: { gate: Gate; names: Record<string, string> }) {
  const { t } = useTranslation();
  if (!gate.refusal) return null;
  const missing = gate.missing.map((id) => names[id] ?? t('common.teamMember'));
  return (
    <Banner tone="error" icon={CircleX} title={t('lockout.refusedTitle')}>
      {missing.length > 0
        ? t('lockout.missingPeople', { names: missing.join(', ') })
        : gate.refusal}
    </Banner>
  );
}

function Ticking({ gate, steps }: { gate: Gate; steps: LockoutStep[] }) {
  const { t } = useTranslation();
  const label = useLabel();
  const done = steps.filter((step) => gate.ticks.has(step.code)).length;
  return (
    <>
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
  const content =
    view?.kind === 'ticking' ? (
      <Ticking gate={gate} steps={view.steps} />
    ) : view?.kind === 'confirmed' ? (
      <Confirmed gate={gate} names={names} timeZone={timeZone} />
    ) : view?.kind === 'record' ? (
      <Banner tone="attention" title={t('lockout.recordTitle')}>
        {t('lockout.record')}
      </Banner>
    ) : (
      <Banner tone="attention" title={t('lockout.noStepsTitle')}>
        {t('lockout.noSteps')}
      </Banner>
    );
  return (
    <>
      <Refusal gate={gate} names={names} />
      {content}
    </>
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
