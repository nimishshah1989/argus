import { useQuery } from '@tanstack/react-query';
import { getConfig, getMe, getState, type Config, type Me, type Ticket } from '../../api.js';

const MAINTENANCE = ['technician', 'supervisor', 'head', 'admin'];
const RECENT = 'floor.recent';

/** The floor's addresses; `m` is the deep link's machine (v3.reporting.10). */
export const FLOOR = { report: '/floor', other: '/floor/other', mine: '/floor/mine', machine: 'm' };

export interface FloorData {
  config: Config;
  me: Me;
  /** The open ticket on each machine. */
  open: Map<string, Ticket>;
  maintenance: boolean;
  /** "Name (Title)" for "Reporting as". */
  who: string;
}

/** What the floor has so far: the data, or why it has none (`error`, null while it still loads) and how to try again. */
export interface FloorLoad {
  data: FloorData | null;
  error: unknown;
  retry: () => void;
}

/**
 * Plant, live state and the acting person. Seam: the person comes from the session (`me`); once
 * sign-in asks a shared phone "who is acting" (decision, slice 2), this stays the only reader.
 * "Still loading" and "failed" are different answers, so a failed load never waits forever.
 */
export function useFloorData(): FloorLoad {
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const state = useQuery({ queryKey: ['state'], queryFn: getState });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const retry = () => {
    for (const query of [config, state, me]) void query.refetch();
  };
  if (!config.data || !me.data) {
    const error = (config.data ? null : config.error) ?? (me.data ? null : me.error);
    return { data: null, error, retry };
  }
  const user = me.data.user;
  const open = new Map<string, Ticket>();
  for (const t of state.data?.open ?? []) if (t.machineId) open.set(t.machineId, t);
  const data: FloorData = {
    config: config.data,
    me: user,
    open,
    maintenance: MAINTENANCE.includes(user.role),
    who: user.title ? `${user.name} (${user.title})` : user.name,
  };
  return { data, error: null, retry };
}

/** The last five machines reported from this phone (v3 shows three). */
export function readRecent(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(RECENT) ?? '[]');
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberRecent(machineId: string): void {
  try {
    const next = [machineId, ...readRecent().filter((id) => id !== machineId)].slice(0, 5);
    localStorage.setItem(RECENT, JSON.stringify(next));
  } catch {
    // Private mode or full storage: recent machines are a convenience only.
  }
}

/** "09:58" for today, the date otherwise; the floor reads local time. */
export const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
