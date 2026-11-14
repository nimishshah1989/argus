import { useTranslation } from 'react-i18next';
import { tickets, type Ticket } from '../../api.js';
import { QueuePage } from '../../patterns/queue-page.js';
import { MachineCard } from '../../ui/floor-pieces.js';
import { StatusPill } from '../../ui/status/status-pill.js';
import { Text } from '../../ui/text.js';
import { CancelComplaint } from './cancel-complaint.js';
import { FloorLoading, FloorShell } from './floor-shell.js';
import { floorStatus } from './machines.js';
import { ticketPlace } from './sent.js';
import { clock, useFloorData, type FloorData } from './use-floor.js';

const KIND = {
  stopped: 'reportFloor.kindStopped',
  support: 'reportFloor.kindSupport',
  general: 'floor.workRequest',
} as const;

function ComplaintStatus({ ticket }: { ticket: Ticket }) {
  const status = floorStatus(ticket);
  /* eslint-disable i18next/no-literal-string -- status groups, not copy */
  return status.group === 'floor' ? (
    <StatusPill group="floor" id={status.id} />
  ) : (
    <StatusPill group="ticket" id={status.id} />
  );
  /* eslint-enable i18next/no-literal-string */
}

function Complaint({ data, ticket }: { data: FloorData; ticket: Ticket }) {
  const { t } = useTranslation();
  return (
    <MachineCard code={ticketPlace(data, ticket)} status={<ComplaintStatus ticket={ticket} />}>
      <Text size="footnote" weight="bold" tone={ticket.kind === 'stopped' ? 'danger' : 'secondary'}>
        {`${t(KIND[ticket.kind])} · ${ticket.ref}`}
      </Text>
      <Text>{ticket.problem}</Text>
      <Text size="footnote" tone="secondary">
        {t('reportFloor.reportedAt', { time: clock(ticket.reportedAt) })}
      </Text>
      <CancelComplaint data={data} ticket={ticket} />
    </MachineCard>
  );
}

/** My complaints: what this person reported, in the floor's words (A2-2, decision 6). */
export function MyComplaints() {
  const { t } = useTranslation();
  const data = useFloorData();
  if (!data)
    return (
      <FloorShell>
        <FloorLoading title={t('floor.complaints')} />
      </FloorShell>
    );
  return (
    <FloorShell>
      <QueuePage
        title={t('floor.complaints')}
        quietOnline
        resource={tickets}
        query={{ raisedBy: data.me.actingPersonId }}
        row={(ticket) => <Complaint data={data} ticket={ticket} />}
        rowKey={(ticket) => ticket.id}
        empty={t('floor.complaintsEmpty')}
      />
    </FloorShell>
  );
}
