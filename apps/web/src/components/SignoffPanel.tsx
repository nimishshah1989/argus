import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Config, Ticket } from '../api.js';
import { MinuteTiles } from '../ui/detail-kit.js';
import { Banner, type BannerTone } from '../ui/banner.js';
import { formatMinutes, formatTime, peopleNames } from './format.js';
import {
  formatLimit,
  signoffLimitMin,
  signoffState,
  waitedMin,
  type Handback,
  type SignoffState,
} from './signoff.js';

const TONE: Record<SignoffState, BannerTone> = {
  asking: 'info',
  confirmed: 'info',
  reopened: 'error',
  timedOut: 'attention',
};

interface Copy {
  title: string;
  sub: string;
  answer: string;
}

/** The headline, the line under it and production's figure for each state of the sign-off. */
function copyFor(t: TFunction, handback: Handback, config?: Config): Copy {
  const zone = config?.timeZone;
  const at = (iso: string | null) => (iso ? formatTime(iso, zone) : '');
  const limit = signoffLimitMin(handback);
  const limitText = limit === null ? '' : formatLimit(limit);
  const who = handback.respondedByPersonId
    ? (peopleNames(config?.people)[handback.respondedByPersonId] ?? t('common.teamMember'))
    : '';
  const answered = formatMinutes(handback.turnaround.productionMin);
  const when = at(handback.respondedAt);
  switch (signoffState(handback)) {
    case 'asking':
      return {
        title: t('signoff.deskWaiting'),
        sub: t(limit === null ? 'signoff.deskWaitingNoLimit' : 'signoff.deskWaitingSub', {
          time: at(handback.requestedAt),
          soFar: formatMinutes(waitedMin(handback, new Date().toISOString())),
          limit: limitText,
        }),
        answer: t('signoff.waiting'),
      };
    case 'confirmed':
      return {
        title: t('signoff.deskConfirmed'),
        sub: t('signoff.deskConfirmedSub', { who, time: when, after: answered }),
        answer: answered,
      };
    case 'reopened':
      return {
        title: t('signoff.deskDisputed'),
        sub: t('signoff.deskDisputedSub', {
          who,
          time: when,
          reason: handback.disputeReason ?? '',
        }),
        answer: answered,
      };
    case 'timedOut':
      return {
        title: t('signoff.deskTimedOut'),
        sub: t('signoff.deskTimedOutSub', { limit: limitText }),
        answer: t('signoff.none'),
      };
  }
}

/** The desk's view of production's sign-off: where it stands and the turnaround both ways (slice 6, frames 13 to 20). */
export function SignoffPanel({ ticket, config }: { ticket: Ticket; config?: Config }) {
  const { t } = useTranslation();
  const { handback } = ticket;
  if (!handback) return null;
  const copy = copyFor(t, handback, config);
  const tiles = [
    {
      label: t('signoff.maintenance'),
      value: formatMinutes(handback.turnaround.maintenanceMin),
      hint: ticket.closedAt
        ? t('signoff.maintenanceHint', {
            from: formatTime(ticket.reportedAt, config?.timeZone),
            to: formatTime(ticket.closedAt, config?.timeZone),
          })
        : undefined,
    },
    { label: t('signoff.production'), value: copy.answer },
    ...(handback.reopenCount > 0
      ? [
          {
            label: t('signoff.reopenedCount'),
            value: t('signoff.reopenedTimes', { count: handback.reopenCount }),
            hint: t('signoff.escalationHint'),
          },
        ]
      : []),
  ];
  return (
    <section aria-label={copy.title} className="flex flex-col gap-3">
      <Banner tone={TONE[signoffState(handback)]} title={copy.title}>
        {copy.sub}
      </Banner>
      <MinuteTiles tiles={tiles} />
    </section>
  );
}
