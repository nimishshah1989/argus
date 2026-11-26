/* eslint-disable i18next/no-literal-string -- notice tones and icon names only; every visible word goes through t() */
import { useTranslation } from 'react-i18next';
import type { LockoutStep } from '@uptimo/shared/lockout';
import { formatTime } from '../../../../components/format.js';
import { localisedLabel } from '../../../../components/lockout.js';
import { Notice } from '../../../../ui/v2/notice.js';
import { TickRow } from '../../../../ui/v2/tick-row.js';
import { useLockoutGate, type Gate } from '../LockoutGate.js';
import { LockoutTag } from './StatusTag.js';

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
    <Notice tone="error" icon="close" title={t('lockout.refusedTitle')}>
      {missing.length > 0
        ? t('lockout.missingPeople', { names: missing.join(', ') })
        : gate.refusal}
    </Notice>
  );
}

function Ticking({ gate, steps }: { gate: Gate; steps: LockoutStep[] }) {
  const { t } = useTranslation();
  const label = useLabel();
  const done = steps.filter((step) => gate.ticks.has(step.code)).length;
  return (
    <>
      <p className="v2-sub">
        {gate.busy ? t('lockout.progress', { done, total: steps.length }) : t('lockout.intro')}
      </p>
      <div className="v2-stack v2-ticket-gap-sm">
        {steps.map((step) => (
          <TickRow
            key={step.code}
            label={label(step)}
            checked={gate.ticks.has(step.code)}
            disabled={gate.busy}
            onChange={(on) => gate.tick(step.code, on)}
          />
        ))}
      </div>
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
      <Notice tone="ok" title={t('lockout.confirmedTitle')}>
        {t(key, { name, time, count: view.steps.length })}
      </Notice>
      <p className="v2-sub">{view.steps.map(label).join(' · ')}</p>
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
      <Notice tone="attention" title={t('lockout.recordTitle')}>
        {t('lockout.record')}
      </Notice>
    ) : (
      <Notice tone="attention" title={t('lockout.noStepsTitle')}>
        {t('lockout.noSteps')}
      </Notice>
    );
  return (
    <>
      <Refusal gate={gate} names={names} />
      {content}
    </>
  );
}

/** The lockout steps of a flagged ticket (v1 `LockoutCard`, slice 7): ticks before Start, or who confirmed. */
export function LockoutCard({ names, timeZone }: Props) {
  const { t } = useTranslation();
  const gate = useLockoutGate();
  if (!gate.view) return null;
  return (
    <section aria-label={t('lockout.title')} className="v2-card v2-pad v2-stack v2-ticket-gap">
      <div className="v2-card-head">
        <h2 className="v2-h2">{t('lockout.title')}</h2>
        <LockoutTag />
      </div>
      <Body gate={gate} names={names} timeZone={timeZone} />
    </section>
  );
}
