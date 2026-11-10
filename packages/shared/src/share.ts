/**
 * WhatsApp share text (SPEC 1.8): one pure function produces the short and full ticket messages.
 * No DOM and no i18n here — callers pass the tenant config (time zone, machines, name).
 */

export type ShareMode = 'short' | 'full';

export interface ShareMachine {
  id?: string;
  code: string;
  category?: string | null;
  cell?: string | null;
}

export interface ShareFigures {
  responseMin: number | null;
  activeMin: number;
  waitMin: number;
  downAccMin?: number;
  downtimeMin: number | null;
  repairMin: number;
}

export interface ShareTicket {
  ref: string;
  kind: 'stopped' | 'support' | 'general';
  status: 'open' | 'working' | 'waiting' | 'closed' | 'cancelled';
  problem: string;
  machineId?: string | null;
  machineSnapshot?: {
    code?: string | null;
    category?: string | null;
    cell?: string | null;
  } | null;
  location?: string | null;
  workType?: string | null;
  urgent?: boolean;
  handedOver?: boolean;
  reportedAt?: string | null;
  startedAt?: string | null;
  closedAt?: string | null;
  figures?: ShareFigures | null;
}

export interface ShareConfig {
  tenantName?: string;
  timeZone?: string;
  machines?: ShareMachine[];
}

function machineFor(ticket: ShareTicket, config: ShareConfig): ShareMachine | null {
  const snapshot: NonNullable<ShareTicket['machineSnapshot']> = ticket.machineSnapshot ?? {};
  const fromConfig: ShareMachine = config.machines?.find(
    (machine) => machine.id === ticket.machineId,
  ) ?? { code: '' };
  const code = snapshot.code || fromConfig.code;
  if (!code) return null;
  return {
    code,
    category: snapshot.category ?? fromConfig.category ?? null,
    cell: snapshot.cell ?? fromConfig.cell ?? null,
  };
}

/** `VC-17 (VMC, Cell A)` for a machine, `Cell B (Housekeeping)` for a work request. */
function whereText(ticket: ShareTicket, config: ShareConfig): string | null {
  if (ticket.kind === 'general') {
    const location = ticket.location ?? '';
    const workType = ticket.workType ?? '';
    if (location && workType) return `${location} (${workType})`;
    return location || workType || null;
  }
  const machine = machineFor(ticket, config);
  if (!machine) return null;
  const details = [machine.category, machine.cell].filter(Boolean).join(', ');
  return details ? `${machine.code} (${details})` : machine.code;
}

function statusLabel(ticket: ShareTicket): string {
  if (ticket.status === 'cancelled') return 'CANCELLED';
  if (ticket.status === 'closed') return 'CLOSED';
  if (ticket.status === 'open' && ticket.handedOver) {
    return 'TRANSFERRED, WAITING TO BE PICKED UP';
  }
  if (ticket.status === 'working') return 'IN PROGRESS';
  if (ticket.status === 'waiting') return 'WAITING';
  if (ticket.kind === 'general') return ticket.urgent ? 'WORK REQUEST (URGENT)' : 'WORK REQUEST';
  if (ticket.kind === 'support') return 'NEEDS SUPPORT';
  return 'MACHINE STOPPED';
}

/** Durations read as `n min`, `h h mm min`, `d d h h` (DOMAIN.md §5). */
function duration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  if (hours < 24) return `${hours} h ${total % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

function timestamp(iso: string | null | undefined, timeZone?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(date);
}

function shortText(ticket: ShareTicket, config: ShareConfig): string {
  const where = whereText(ticket, config);
  const head = `${ticket.ref || 'Ticket'} · ${statusLabel(ticket)}${where ? `: ${where}` : ''}`;
  return `${head}\n${ticket.problem?.trim() || '(no problem text)'}`;
}

function timeLines(ticket: ShareTicket, timeZone?: string): string[] {
  const rows: [string, string | null | undefined][] = [
    ['Reported', ticket.reportedAt],
    ['Started', ticket.startedAt],
    ['Closed', ticket.closedAt],
  ];
  return rows.flatMap(([label, iso]) => {
    const value = timestamp(iso, timeZone);
    return value ? [`${label}: ${value}`] : [];
  });
}

function figureLines(
  figures: ShareFigures | null | undefined,
  kind: ShareTicket['kind'],
): string[] {
  if (!figures) return [];
  const lines: string[] = [];
  if (figures.responseMin != null) lines.push(`Response: ${duration(figures.responseMin)}`);
  if (figures.activeMin > 0) lines.push(`Hands-on: ${duration(figures.activeMin)}`);
  if (figures.waitMin > 0) lines.push(`Waiting: ${duration(figures.waitMin)}`);
  const downtime = kind === 'stopped' ? (figures.downtimeMin ?? figures.downAccMin ?? null) : null;
  if (downtime != null) lines.push(`Downtime: ${duration(downtime)}`);
  if (figures.repairMin > 0) lines.push(`Repair: ${duration(figures.repairMin)}`);
  return lines;
}

function fullText(ticket: ShareTicket, config: ShareConfig): string {
  const lines = [
    shortText(ticket, config),
    ...timeLines(ticket, config.timeZone),
    ...figureLines(ticket.figures, ticket.kind),
  ];
  if (config.tenantName) lines.push(`— ${config.tenantName}`);
  return lines.join('\n');
}

/** The short or full WhatsApp text for a ticket. */
export function shareText(
  ticket: ShareTicket,
  config: ShareConfig = {},
  mode: ShareMode = 'short',
): string {
  return mode === 'full' ? fullText(ticket, config) : shortText(ticket, config);
}

/** The click-to-chat link with the text encoded for WhatsApp. */
export function waMeUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
