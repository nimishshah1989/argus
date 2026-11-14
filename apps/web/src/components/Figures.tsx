import { useTranslation } from 'react-i18next';
import type { Figures as TicketFigures, RaiseKind } from '../api.js';
import { MinuteTiles, SectionTitle } from '../ui/detail-kit.js';
import { Stack } from '../ui/layout.js';
import { formatMinutes } from './format.js';

interface Props {
  figures: TicketFigures | null;
  kind: RaiseKind;
  /** An open breakdown's downtime so far (the figures hold finished stretches only). */
  liveDownMin?: number;
  /** What the ticket waits for, under the Waiting figure. */
  waitingFor?: string;
}

/** The three minute tiles: downtime (a stopped machine only), hands-on work and waiting. */
export function Figures({ figures, kind, liveDownMin, waitingFor }: Props) {
  const { t } = useTranslation();
  if (!figures) return null;
  const downtime =
    kind === 'stopped' ? (figures.downtimeMin ?? liveDownMin ?? figures.downAccMin) : null;
  const tiles = [
    ...(downtime === null
      ? []
      : [
          {
            label: t('detail.tile.downtime'),
            value: formatMinutes(downtime),
            hint: t('detail.hint.stopped'),
          },
        ]),
    {
      label: t('detail.tile.workTime'),
      value: formatMinutes(figures.activeMin),
      hint: t('detail.hint.handsOn'),
    },
    { label: t('detail.tile.waiting'), value: formatMinutes(figures.waitMin), hint: waitingFor },
  ];
  return (
    <Stack gap={2}>
      <SectionTitle>{t('detail.minutes')}</SectionTitle>
      <MinuteTiles tiles={tiles} />
    </Stack>
  );
}
