import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ApiError,
  listTickets,
  raiseTicket,
  type Group,
  type Machine,
  type Ticket,
} from '../../api.js';
import { useCommand } from '../../data/index.js';
import { machineByCode } from './machines.js';
import { rememberRecent, type FloorData } from './use-floor.js';

const OPEN: Ticket['status'][] = ['open', 'working', 'waiting'];

async function openTicketOn(machineId: string): Promise<Ticket | undefined> {
  return (await listTickets({ machineId, status: OPEN, limit: 1 })).items[0];
}

/**
 * The report in progress. A stopped report on a machine whose open ticket is `support` upgrades that
 * ticket; a send answered "already open" (409, also the race loser) opens the existing ticket.
 */
export function useReport(data: FloorData, deepLink: string | null) {
  const queryClient = useQueryClient();
  const command = useCommand();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<Group | null>(null);
  const [machine, setMachine] = useState<Machine | null>(
    () => (deepLink ? machineByCode(data.config.machines, deepLink) : undefined) ?? null,
  );
  const [kind, setKind] = useState<'stopped' | 'support'>('stopped');
  const [problem, setProblem] = useState('');
  const [startNow, setStartNow] = useState(false);
  const [sheet, setSheet] = useState<Ticket | null>(null);
  const [sent, setSent] = useState<Ticket | null>(null);
  const existing = machine ? data.open.get(machine.id) : undefined;
  const supportTicket = existing?.kind === 'support' ? existing : undefined;
  const upgrade = Boolean(supportTicket) && kind === 'stopped';

  /** An open breakdown opens its ticket; a free machine or a support ticket goes on to Step 2. */
  function pick(m: Machine, next: () => void): void {
    const open = data.open.get(m.id);
    if (open && open.kind !== 'support') return setSheet(open);
    setMachine(m);
    setKind('stopped');
    next();
  }

  async function refresh(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['state'] }),
      queryClient.invalidateQueries({ queryKey: ['tickets'] }),
    ]);
  }

  async function upgradeSupport(ticket: Ticket): Promise<void> {
    const ok = await command.run(ticket.id, 'upgrade-kind', { personId: data.me.actingPersonId });
    if (!ok) throw new Error(command.error ?? 'upgrade-kind failed');
    setSent({ ...ticket, kind: 'stopped' });
  }

  async function send(): Promise<void | false> {
    if (!machine) return false;
    if (upgrade && supportTicket) return upgradeSupport(supportTicket);
    try {
      const body = { kind, machineId: machine.id, problem: problem.trim(), startNow };
      const { ticket } = await raiseTicket(body);
      rememberRecent(machine.id);
      setSent(ticket);
      await refresh();
    } catch (error) {
      const open = error instanceof ApiError && error.code === 'conflict';
      const found = open ? await openTicketOn(machine.id) : undefined;
      if (!found) throw error;
      setSheet(found);
      return false;
    }
  }

  return {
    ...{ query, setQuery, group, setGroup, machine, setMachine, kind, setKind },
    ...{ problem, setProblem, startNow, setStartNow, sheet, setSheet, sent },
    ...{ existing, supportTicket, upgrade, pick, send },
  };
}
export type ReportState = ReturnType<typeof useReport>;
