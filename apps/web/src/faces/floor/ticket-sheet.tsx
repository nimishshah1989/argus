import { useTranslation } from 'react-i18next';
import type { Ticket } from '../../api.js';
import { Stack } from '../../ui/layout.js';
import { Sheet } from '../../ui/sheet.js';
import { Text } from '../../ui/text.js';
import { TicketFacts, ticketPlace } from './sent.js';
import { clock, type FloorData } from './use-floor.js';

/** "Already reported": the open ticket on that machine, read only (A3-5). */
export function TicketSheet(p: { data: FloorData; ticket: Ticket | null; onClose: () => void }) {
  const { t } = useTranslation();
  const ticket = p.ticket;
  return (
    <Sheet
      open={ticket !== null}
      onOpenChange={(open) => (open ? undefined : p.onClose())}
      title={ticket ? ticketPlace(p.data, ticket) : ''}
    >
      {ticket ? (
        <Stack gap={3}>
          <TicketFacts data={p.data} ticket={ticket} />
          <Text size="footnote" tone="secondary">
            {ticket.startedAt
              ? t('reportFloor.workStarted', { time: clock(ticket.startedAt) })
              : t('reportFloor.notStarted')}
          </Text>
        </Stack>
      ) : null}
    </Sheet>
  );
}
