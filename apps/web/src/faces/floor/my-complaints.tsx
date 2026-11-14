import { useTranslation } from 'react-i18next';
import { tickets, type Ticket } from '../../api.js';
import { QueuePage } from '../../patterns/queue-page.js';
import { MachineCard } from '../../ui/floor-pieces.js';
import { Page } from '../../ui/layout.js';
import { StatusPill } from '../../ui/status/status-pill.js';
import { Text } from '../../ui/text.js';
import { floorStatus } from './machines.js';
import { ticketPlace } from './sent.js';
import { clock, useFloorData, type FloorData } from './use-floor.js';

const KIND = {
  stopped: 'reportFloor.kindStopped',
  support: 'reportFloor.kindSupport',
  general: 'floor.workRequest',
} as const;

function Complaint({ data, ticket }: { data: FloorData; ticket: Ticket }) {
  const { t } = useTranslation();
  return (
    <MachineCard
      code={ticketPlace(data, ticket)}
      // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
      status={<StatusPill group="floor" id={floorStatus(ticket)} />}
    >
      <Text size="footnote" weight="bold" tone={ticket.kind === 'stopped' ? 'danger' : 'secondary'}>
        {`${t(KIND[ticket.kind])} · ${ticket.ref}`}
      </Text>
      <Text>{ticket.problem}</Text>
      <Text size="footnote" tone="secondary">
        {t('reportFloor.reportedAt', { time: clock(ticket.reportedAt) })}
      </Text>
    </MachineCard>
  );
}

/** My complaints: what this person reported, in the floor's words (A2-2, decision 6). */
export function MyComplaints() {
  const { t } = useTranslation();
  const data = useFloorData();
  if (!data) return <Page />;
  return (
    <Page>
      <QueuePage
        title={t('floor.complaints')}
        resource={tickets}
        query={{ raisedBy: data.me.actingPersonId }}
        row={(ticket) => <Complaint data={data} ticket={ticket} />}
        rowKey={(ticket) => ticket.id}
        empty={t('floor.complaintsEmpty')}
      />
    </Page>
  );
}
