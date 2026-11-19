import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { tickets, type Ticket } from '../../api.js';
import { machineLabel } from '../../components/format.js';
import { QueuePage } from '../../patterns/queue-page.js';
import { MachineCard } from '../../ui/floor-pieces.js';
import { StatusPill } from '../../ui/status/status-pill.js';
import { floorStatus } from './machines.js';
import { Text } from '../../ui/text.js';
import { FloorShell, FloorWaiting } from './floor-shell.js';
import { useFloorData, type FloorData } from './use-floor.js';

function JobStatus({ ticket }: { ticket: Ticket }) {
  const status = floorStatus(ticket);
  /* eslint-disable i18next/no-literal-string -- status groups, not copy */
  return status.group === 'floor' ? (
    <StatusPill group="floor" id={status.id} />
  ) : (
    <StatusPill group="ticket" id={status.id} />
  );
  /* eslint-enable i18next/no-literal-string */
}

/** One PM job: the machine, its reference, the plan's title and where the job stands. */
function PmJob({ data, ticket }: { data: FloorData; ticket: Ticket }) {
  return (
    <Link to={`/desk/${ticket.id}`}>
      <MachineCard
        code={machineLabel(ticket, data.config.machines)}
        detail={ticket.ref}
        status={<JobStatus ticket={ticket} />}
      >
        <Text>{ticket.problem}</Text>
      </MachineCard>
    </Link>
  );
}

/** The technician's PM jobs (ticket 49c): the open PM tickets, planned work rather than a breakdown. */
export function PmJobs() {
  const { t } = useTranslation();
  const load = useFloorData();
  const data = load.data;
  if (!data)
    return (
      <FloorShell>
        <FloorWaiting title={t('pm.jobs.title')} load={load} />
      </FloorShell>
    );
  return (
    <FloorShell maintenance={data.maintenance}>
      <QueuePage
        title={t('pm.jobs.title')}
        quietOnline
        resource={tickets}
        // eslint-disable-next-line i18next/no-literal-string -- query values, not copy
        query={{ channel: ['pm'], status: ['open', 'working'] }}
        row={(ticket) => <PmJob data={data} ticket={ticket} />}
        rowKey={(ticket) => ticket.id}
        empty={t('pm.jobs.empty')}
      />
    </FloorShell>
  );
}
