/* eslint-disable i18next/no-literal-string -- route and tone props, not copy */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getConfig,
  getMe,
  getTicket,
  type CommandAction,
  type CommandBody,
  type Config,
  type Me,
  type TicketDetail as TicketDetailData,
  type TicketInterval,
} from '../api.js';
import { AdminPanel } from '../components/AdminPanel.js';
import { actionSpecs, actorFrom, crewFrom } from '../components/actionSpecs.js';
import { LockoutCard } from '../components/LockoutCard.js';
import { LockoutChip } from '../components/LockoutChip.js';
import { LockoutGate } from '../components/LockoutGate.js';
import { lockoutView } from '../components/lockout.js';
import { useCommand } from '../data/index.js';
import { Facts, ReportCard } from '../components/TicketFacts.js';
import { CloseFlow } from '../components/CloseFlow.js';
import { ReportControls } from '../components/ReportControls.js';
import { ShareButton } from '../components/ShareButton.js';
import { Figures } from '../components/Figures.js';
import { KindBadge, ReportBadge, StatusBadge } from '../components/StatusBadge.js';
import { SignoffPanel } from '../components/SignoffPanel.js';
import { SlaTimerSummary } from '../components/SlaTimerSummary.js';
import { OfflineBanner } from '../components/OfflineBanner.js';
import { Timeline } from '../components/Timeline.js';
import { downNow } from '../components/liveDowntime.js';
import {
  errorMessage,
  formatMinutes,
  formatTime,
  machineLabel,
  peopleNames,
} from '../components/format.js';
import { SyncStatus } from '../patterns/sync-status.js';
import { Banner } from '../ui/banner.js';
import { PersonRows, SectionTitle } from '../ui/detail-kit.js';
import { Inline, Stack } from '../ui/layout.js';
import { TopBar } from '../ui/top-bar.js';

const ROLE_LABEL_KEYS: Record<string, string> = {
  lead: 'role.lead',
  primary: 'role.primary',
  support: 'role.support',
};

function intervalMinutes(interval: TicketInterval): number {
  const end = interval.endedAt ? new Date(interval.endedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - new Date(interval.startedAt).getTime()) / 60000));
}

interface PeopleProps {
  detail: TicketDetailData;
  names: Record<string, string>;
  timeZone?: string;
}

function PeopleSection({ detail, names, timeZone }: PeopleProps) {
  const { t } = useTranslation();
  const { people, intervals, events, ticket } = detail;
  // The lead is not a crew row; the screen lists them first, as the mockup does.
  const lead = ticket.leadPersonId
    ? [{ personId: ticket.leadPersonId, role: 'lead', leftAt: null, leftReason: null }]
    : [];
  const members = [...lead, ...people.filter((member) => member.personId !== ticket.leadPersonId)];
  const rows = members.map((member) => {
    const own = intervals.filter((interval) => interval.personId === member.personId);
    const joined =
      own.map((interval) => interval.startedAt).sort()[0] ??
      events.find((event) => event.actingPersonId === member.personId)?.at;
    const minutes =
      ticket.figures?.perPerson[member.personId] ??
      own.reduce((sum, interval) => sum + intervalMinutes(interval), 0);
    const role = t(ROLE_LABEL_KEYS[member.role] ?? member.role);
    const sub = joined ? t('detail.joined', { role, time: formatTime(joined, timeZone) }) : role;
    return {
      key: member.personId,
      name: names[member.personId] ?? t('common.teamMember'),
      sub: member.leftAt ? `${sub} · ${t('ticket.left')}` : sub,
      value: formatMinutes(minutes),
    };
  });
  return (
    <Stack gap={2}>
      <SectionTitle>{t('detail.people')}</SectionTitle>
      {rows.length === 0 ? (
        <p className="text-body text-neutral-600">{t('ticket.peopleEmpty')}</p>
      ) : (
        <PersonRows rows={rows} />
      )}
    </Stack>
  );
}

interface ViewProps {
  detail: TicketDetailData;
  config?: Config;
  me?: Me;
  run: (ticketId: string, action: CommandAction, body: CommandBody) => Promise<boolean>;
  pending: boolean;
  error: string | null;
  onFlow: (mode: 'close' | 'late') => void;
}

function hasReportContext(
  config: Config | undefined,
  personId: string | null | undefined,
): boolean {
  return Boolean(config && personId);
}

/** A closed breakdown or support ticket either has its report or still needs it. */
function reportState(detail: TicketDetailData): 'with' | 'needs' | null {
  const { ticket, report } = detail;
  if (ticket.status !== 'closed' || ticket.kind === 'general') return null;
  if (report || ticket.closeKind === 'report') return 'with';
  return ticket.closeKind === 'no_report' ? 'needs' : null;
}

/** The machine's type and cell, e.g. "Turning Center · Cell 6". */
function machineLine(detail: TicketDetailData, config?: Config): string {
  const { ticket } = detail;
  const machine = config?.machines.find((item) => item.id === ticket.machineId);
  const category = ticket.machineSnapshot?.category ?? machine?.category;
  const cell = ticket.machineSnapshot?.cell ?? machine?.cell;
  return [category, cell].filter(Boolean).join(' · ');
}

function Header({ detail, config }: { detail: TicketDetailData; config?: Config }) {
  const { ticket } = detail;
  const live = ['open', 'working', 'waiting'].includes(ticket.status);
  const report = reportState(detail);
  const line = machineLine(detail, config);
  return (
    <header>
      <Stack gap={2}>
        <h1 className="flex flex-wrap items-center gap-2 text-title1 font-extrabold leading-tight">
          <span>
            {ticket.kind === 'general' ? ticket.ref : machineLabel(ticket, config?.machines)}
          </span>
          {ticket.kind === 'general' ? null : (
            <span className="rounded-lg bg-muted-tint px-2 py-0.5 font-mono text-caption font-medium text-muted-ink">
              {ticket.ref}
            </span>
          )}
        </h1>
        <Inline gap={2}>
          {live ? <KindBadge kind={ticket.kind} /> : null}
          <StatusBadge status={ticket.status} handedOver={ticket.handedOver} />
          {report ? <ReportBadge state={report} /> : null}
          {ticket.lockout ? <LockoutChip /> : null}
        </Inline>
        {line ? <p className="text-footnote text-neutral-600">{line}</p> : null}
        <p className="text-body">{ticket.problem}</p>
      </Stack>
    </header>
  );
}

interface ControlsProps extends Omit<ViewProps, 'detail'> {
  ticket: TicketDetailData['ticket'];
  people: TicketDetailData['people'];
}

/** The report form and the action bar. */
function Controls({ ticket, config, me, run, pending, error, people, onFlow }: ControlsProps) {
  const personId = me?.actingPersonId;
  const actor = me ? actorFrom(me) : null;
  if (!hasReportContext(config, personId) || actor === null) return null;
  return (
    <ReportControls
      ticket={ticket}
      config={config!}
      personId={personId!}
      actor={actor}
      crew={crewFrom(people)}
      command={(action, body) => run(ticket.id, action, body)}
      pending={pending}
      error={error}
      onFlow={onFlow}
    />
  );
}

/** Who is acting and what the lockout card shows them: the ticks before Start, who confirmed, or nothing. */
function lockoutFor(detail: TicketDetailData, me?: Me) {
  const { ticket, people } = detail;
  const personId = me?.actingPersonId ?? '';
  const actor = me ? actorFrom(me) : null;
  if (!personId || !actor) return { personId, view: null };
  const onCrew =
    ticket.leadPersonId === personId ||
    people.some((member) => member.personId === personId && !member.leftAt);
  const offered = actionSpecs(ticket, crewFrom(people), actor).map((spec) => spec.action);
  const status = ticket.status;
  return {
    personId,
    view: lockoutView({ lockout: ticket.lockout, status, personId, onCrew, offered }),
  };
}

function TicketView({ detail, config, me, run, pending, error, onFlow }: ViewProps) {
  const { ticket, events, people } = detail;
  const names = peopleNames(config?.people);
  const reasonLabels: Record<string, string> = {};
  for (const item of config?.lists.wait_reason ?? []) reasonLabels[item.code] = item.label;
  const liveDown = downNow(ticket, new Date().toISOString());
  return (
    <LockoutGate key={ticket.id} ticketId={ticket.id} {...lockoutFor(detail, me)}>
      <Stack gap={6}>
        <Header detail={detail} config={config} />
        <SignoffPanel ticket={ticket} config={config} />
        <SlaTimerSummary ticket={ticket} detailed config={config} />
        <Facts ticket={ticket} config={config} names={names} liveDownMin={liveDown} />
        <LockoutCard names={names} timeZone={config?.timeZone} />
        {detail.report && <ReportCard report={detail.report} names={names} />}
        <ShareButton ticket={ticket} config={config} mode="full" />
        <Figures
          figures={ticket.figures}
          kind={ticket.kind}
          liveDownMin={liveDown}
          waitingFor={ticket.waitReason ? reasonLabels[ticket.waitReason] : undefined}
        />
        <PeopleSection detail={detail} names={names} timeZone={config?.timeZone} />
        <Timeline
          events={events}
          names={names}
          reasonLabels={reasonLabels}
          timeZone={config?.timeZone}
        />
        <AdminPanel ticket={ticket} config={config} me={me} />
        <Controls {...{ ticket, config, me, run, pending, error, people, onFlow }} />
      </Stack>
    </LockoutGate>
  );
}

/** `embedded`: inside the desk's right pane, whose frame already shows the sync pill and offline banner. Back clears the pane. */
export function TicketDetail({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const detail = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => getTicket(id),
    enabled: Boolean(id),
  });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const { run, error, pending } = useCommand();
  const [flow, setFlow] = useState<'close' | 'late' | null>(null);
  const personId = me.data?.user.actingPersonId;
  const chrome = embedded
    ? { sync: undefined, banner: null }
    : { sync: <SyncStatus />, banner: <OfflineBanner /> };

  if (flow && detail.data && config.data && personId) {
    const ticketId = detail.data.ticket.id;
    return (
      <CloseFlow
        detail={detail.data}
        config={config.data}
        personId={personId}
        mode={flow}
        pending={pending}
        error={error}
        command={(action, body) => run(ticketId, action, body)}
        onExit={() => setFlow(null)}
      />
    );
  }

  return (
    <>
      <TopBar back={{ to: '/desk', label: t('detail.back') }} trailing={chrome.sync} />
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
        {chrome.banner}
        {detail.data ? (
          <TicketView
            detail={detail.data}
            config={config.data}
            me={me.data?.user}
            run={run}
            pending={pending}
            error={error}
            onFlow={setFlow}
          />
        ) : detail.error ? (
          <Banner tone="error" title={errorMessage(detail.error)} />
        ) : (
          <p className="text-body text-neutral-600">{t('common.loading')}</p>
        )}
      </main>
    </>
  );
}
