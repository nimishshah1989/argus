import { useTranslation } from 'react-i18next';
import { tickets, type Ticket } from '../../api.js';
import { QueuePage } from '../../patterns/queue-page.js';
import { MachineCard } from '../../ui/floor-pieces.js';
import { StatusPill } from '../../ui/status/status-pill.js';
import { Text } from '../../ui/text.js';
import { CancelComplaint } from './cancel-complaint.js';
import { SignoffAsk } from './signoff-ask.js';
import { FloorShell, FloorWaiting } from './floor-shell.js';
import { floorStatus } from './machines.js';
import { ticketPlace } from './sent.js';
import { clock, useFloorData, type FloorData } from './use-floor.js';

const KIND = {
  stopped: 'reportFloor.kindStopped',
  support: 'reportFloor.kindSupport',
  general: 'floor.workRequest',
} as const;

/** A closed ticket production was asked about shows production's side of it, not just "Fixed". */
const SIGNOFF_PILL = {
  requested: 'requested',
  confirmed: 'confirmed',
  timed_out: 'timed_out',
  disputed: null,
} as const;

function ComplaintStatus({ ticket }: { ticket: Ticket }) {
  const status = floorStatus(ticket);
  const sign =
    ticket.status === 'closed' && ticket.handback ? SIGNOFF_PILL[ticket.handback.status] : null;
  /* eslint-disable i18next/no-literal-string -- status groups, not copy */
  if (sign) return <StatusPill group="handback" id={sign} />;
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
      <SignoffAsk data={data} ticket={ticket} />
      <CancelComplaint data={data} ticket={ticket} />
    </MachineCard>
  );
}

/** My complaints: what this person reported, in the floor's words (A2-2, decision 6). */
export function MyComplaints() {
  const { t } = useTranslation();
  const load = useFloorData();
  const data = load.data;
  if (!data)
    return (
      <FloorShell>
        <FloorWaiting title={t('floor.complaints')} load={load} />
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
