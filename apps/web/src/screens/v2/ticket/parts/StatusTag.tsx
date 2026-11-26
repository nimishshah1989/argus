/* eslint-disable i18next/no-literal-string -- tone and icon names only; every visible word goes through t() */
import { useTranslation } from 'react-i18next';
import { statusMeaning, type StatusRef } from '../../../../ui/meaning.js';
import type { Tone } from '../../../../ui/status/index.js';
import type { IconName } from '../../../../ui/v2/icons.js';
import { KeyPill, type PillTone } from '../../../../ui/v2/key-pill.js';

/** A v1 status tone in the kit's words: a loss, a risk, a plan, a hand-over, a gain or plain. */
export const PILL_TONE: Record<Tone, PillTone> = {
  danger: 'loss',
  warning: 'risk',
  hold: 'risk',
  info: 'plan',
  moved: 'decide',
  ok: 'gain',
  muted: 'neutral',
};

const ICON: Record<PillTone, IconName> = {
  loss: 'stop',
  risk: 'alert',
  plan: 'wrench',
  decide: 'chevronRight',
  gain: 'check',
  neutral: 'check',
};

/** A status chip on the kit (v1 `StatusPill`): icon and word together, so colour never carries it alone. */
export function StatusTag({ status }: { status: StatusRef }) {
  const { t } = useTranslation();
  const { tone, label } = statusMeaning(status);
  const pill = PILL_TONE[tone];
  return <KeyPill text={t(label)} tone={pill} icon={ICON[pill]} />;
}

/** The "Needs lockout" chip (v1 `LockoutChip`): the risk tone, an icon and the words. */
export function LockoutTag() {
  const { t } = useTranslation();
  return <KeyPill text={t('lockout.chip')} tone="risk" icon="alert" />;
}
