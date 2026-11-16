import { useTranslation } from 'react-i18next';
import type { Ticket } from '../../api.js';
import { formatMinutes } from '../../components/format.js';
import { formatLimit, signoffLimitMin, signoffState } from '../../components/signoff.js';
import { Text } from '../../ui/text.js';
import { clock } from './use-floor.js';

/** What production's answer, or its absence, looks like on My complaints once the question is over (frames 5 to 7). */
export function SignoffAnswered({ ticket }: { ticket: Ticket }) {
  const { t } = useTranslation();
  const handback = ticket.handback;
  if (!handback) return null;
  const state = signoffState(handback);
  const answeredAt = handback.respondedAt ? clock(handback.respondedAt) : '';
  if (state === 'confirmed')
    return (
      <>
        <Text>{t('signoff.confirmed', { time: answeredAt })}</Text>
        <Text size="footnote" tone="secondary">
          {t('signoff.turnaround', {
            maintenance: formatMinutes(handback.turnaround.maintenanceMin),
            production: formatMinutes(handback.turnaround.productionMin),
          })}
        </Text>
      </>
    );
  if (state === 'reopened')
    return (
      <>
        <Text>{t('signoff.reopened', { time: answeredAt })}</Text>
        {handback.disputeReason ? (
          <Text size="footnote" tone="secondary">
            {t('signoff.yourReason', { reason: handback.disputeReason })}
          </Text>
        ) : null}
      </>
    );
  const limit = signoffLimitMin(handback);
  return (
    <>
      {limit === null ? null : <Text>{t('signoff.timedOut', { limit: formatLimit(limit) })}</Text>}
      {ticket.closedAt ? (
        <Text size="footnote" tone="secondary">
          {t('signoff.closedAt', { time: clock(ticket.closedAt) })}
        </Text>
      ) : null}
    </>
  );
}
