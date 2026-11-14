import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Ticket } from '../../api.js';
import { Button } from '../../ui/button.js';
import { MachineCard } from '../../ui/floor-pieces.js';
import { Stack } from '../../ui/layout.js';
import { StatusPill } from '../../ui/status/status-pill.js';
import { Text } from '../../ui/text.js';
import { rowStatus } from './machines.js';
import { clock, FLOOR, type FloorData } from './use-floor.js';

/** What a ticket is about on the floor: its machine's code, or the place for other work. */
export const ticketPlace = (data: FloorData, ticket: Ticket): string =>
  data.config.machines.find((m) => m.id === ticket.machineId)?.code ?? ticket.location ?? '';

/** "Name (Title)" of whoever reported it. */
function reporter(data: FloorData, ticket: Ticket): string {
  const person = data.config.people.find((x) => x.id === ticket.reportedByPersonId);
  if (!person) return '';
  return person.title ? `${person.name} (${person.title})` : person.name;
}

/** The ticket's own facts: number, problem, when and by whom (A2-1 card). */
export function TicketFacts({ data, ticket }: { data: FloorData; ticket: Ticket }) {
  const { t } = useTranslation();
  return (
    <MachineCard
      code={ticketPlace(data, ticket)}
      // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
      status={<StatusPill group="ticket" id={rowStatus(ticket)} />}
    >
      <Text size="footnote" weight="bold">
        {t('reportFloor.ticketNumber', { ref: ticket.ref })}
      </Text>
      <Text>{ticket.problem}</Text>
      <Text size="footnote" tone="secondary">
        {t('reportFloor.reportedBy', {
          time: clock(ticket.reportedAt),
          who: reporter(data, ticket),
        })}
      </Text>
    </MachineCard>
  );
}

/**
 * Sent (A2-1, decision 2). "See live" waits for the plant's Live-for-the-floor setting (off by
 * default, not built), so it is not offered.
 */
export function Sent(p: { data: FloorData; ticket: Ticket; onAnother: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const code = ticketPlace(p.data, p.ticket);
  return (
    <Stack gap={4}>
      <Stack gap={1}>
        <Text as="h3" size="title2" weight="bold">
          {t('reportFloor.sent')}
        </Text>
        {p.ticket.kind === 'stopped' ? (
          <Text tone="secondary">{t('reportFloor.onLive', { code })}</Text>
        ) : null}
      </Stack>
      <TicketFacts data={p.data} ticket={p.ticket} />
      <Button onClick={p.onAnother}>{t('reportFloor.another')}</Button>
      {/* eslint-disable-next-line i18next/no-literal-string -- prop value, not copy */}
      <Button variant="quiet" onClick={() => navigate(FLOOR.mine)}>
        {t('reportFloor.seeMine')}
      </Button>
    </Stack>
  );
}
