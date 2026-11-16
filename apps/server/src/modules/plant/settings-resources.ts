import type { PoolClient } from 'pg';
import type { ZodTypeAny } from 'zod';
import type { ActorContext } from '@uptimo/domain';
import {
  DEFAULT_MACHINE_CRITICALITY,
  groupCreateSchema,
  groupPatchSchema,
  machineCreateSchema,
  machinePatchSchema,
  segmentCreateSchema,
  segmentPatchSchema,
  shiftCreateSchema,
  shiftPatchSchema,
} from '@uptimo/shared';
import { machineSwitchOffBlocker } from '../../kernel/index.js';
import { tenantInfo } from '../identity/index.js';
import {
  exists,
  groupSegment,
  insertMove,
  latestMoveDate,
  hasOtherActiveShift,
  segmentHasLiveMachines,
  segmentIsOn,
  type Row,
  type Scope,
  type Store,
} from './repo/plant-settings.js';

type Db = Pick<PoolClient, 'query'>;
type Reply = Record<string, unknown>;
/** A rule the values break: 422 by default, 409 when the plant's own state is the reason. */
export type Problem = { field: string; message: string; conflict?: boolean };

/** One settings screen's resource: what the generic list, create and edit routes need to know. */
export interface Resource {
  path: string;
  /** The audit entity; for a resource without its own `store` it is also the table (one of the plant's own). */
  table: string;
  /** Set by a resource of another module, which reads and writes its own tables itself. */
  store?: Store;
  /** Set when one table holds several lists (`list_item`): only that list's rows are visible and written. */
  scope?: Scope;
  /** Prefix of the audit action: `machine.create`, `group.update`. */
  kind: string;
  order: string;
  /** Request key to column. A key not listed is never written. */
  columns: Record<string, string>;
  /** Keys a form may send back unchanged but never change (the code history names, a link with its own route). */
  fixed?: readonly string[];
  /** Absent for a resource that is one row made by its first read: it has no POST. */
  create?: ZodTypeAny;
  patch: ZodTypeAny;
  /** The reply always carries `active`, the one switch the generated screen shows. */
  reply: (row: Row) => Reply;
  /** The key a repeated value breaks (a 409 names it); `code` unless the resource has another. */
  uniqueField?: string;
  /** The 409 text for a repeat, when "That code is already used" does not read right for this resource. */
  taken?: string;
  /** Who may use it (DOMAIN §3); head and admin (the lists cell) unless the resource has its own cell. */
  can?: (actor: ActorContext) => boolean;
  /** What `active: true/false` changes for this resource; none when it has no switch. */
  switchTo?: (active: boolean, before: Reply) => Reply;
  /** The values as they would be after the write; a message when they break a rule of the plant. */
  check?: (
    tx: PoolClient,
    merged: Reply,
    edit: Proposed | undefined,
    tenantId: string,
  ) => Promise<Problem | null>;
  /** Columns worked out from the values, never typed by a person. */
  derive?: (merged: Reply) => Record<string, unknown>;
  actionFor?: (before: Reply, after: Reply) => string;
  /** Runs before the list is read and before a row is created, in that transaction (the ladder seeds here). */
  prepare?: (tx: PoolClient, who: { tenantId: string; loginId: string }) => Promise<void>;
  /** What a list asks for in its query string (`?from&to`); a problem is a 422. The store's `all` receives the filter. */
  listFilter?: (
    tx: PoolClient,
    tenantId: string,
    query: Record<string, unknown>,
  ) => Promise<Problem | Record<string, unknown>>;
  /** Runs inside the edit's transaction once the row is written. */
  afterEdit?: (tx: Db, edit: Edit) => Promise<void>;
  /** Runs inside the transaction of a create or an edit that changed something, once the row is written. */
  afterSave?: (tx: PoolClient, tenantId: string) => Promise<void>;
}

export interface Edit {
  tenantId: string;
  before: Reply;
  after: Reply;
  patch: Reply;
}

/** What an edit asks for, seen before anything is written. */
export interface Proposed {
  tenantId: string;
  before: Reply;
  patch: Reply;
}

const clock = (value: unknown) => String(value).slice(0, 5);

/**
 * The one place a machine is shaped for a caller. A stored null is a machine made before the lock's
 * "criticality starts at B" rule, so it reads as B here (the legacy default) and every screen and
 * severity answer sees a machine that has a criticality.
 */
function machineReply(row: Row): Reply {
  return {
    id: row.id,
    code: row.code,
    category: row.category,
    cell: row.cell,
    area: row.area,
    location: row.location,
    segmentId: row.segment_id,
    groupId: row.group_id,
    criticality: row.criticality ?? DEFAULT_MACHINE_CRITICALITY,
    make: row.make,
    model: row.model,
    serial: row.serial,
    year: row.year,
    status: row.status,
    active: row.status !== 'scrapped',
  };
}

/** Only references the edit touches are checked, so an old machine with odd links can still be switched off. */
async function checkLinks(tx: Db, m: Reply, patch?: Reply): Promise<Problem | null> {
  if (patch && !('segmentId' in patch) && !('groupId' in patch)) return null;
  const segmentId = m.segmentId as string | null | undefined;
  const groupId = m.groupId as string | null | undefined;
  if (segmentId && !(await exists(tx, 'segment', segmentId))) {
    return { field: 'segmentId', message: 'Unknown segment' };
  }
  if (!groupId) return null;
  const groupIn = await groupSegment(tx, groupId);
  if (!groupIn) return { field: 'groupId', message: 'Unknown group' };
  if (groupIn !== segmentId) {
    return { field: 'groupId', message: 'That group belongs to another segment' };
  }
  return null;
}

/** Today in the plant's own time zone, as a date the database and the screens both read. */
export async function plantToday(tx: Db, tenantId: string, at: Date = new Date()): Promise<string> {
  const { time_zone: timeZone } = await tenantInfo(tx, tenantId);
  return at.toLocaleDateString('en-CA', { timeZone });
}

/** A cell change is dated today or earlier, and never before the machine's last move (the history stays in order). */
async function checkMoveDate(tx: Db, edit: Proposed): Promise<Problem | null> {
  const { before, patch } = edit;
  if (!('cell' in patch) || patch.cell === before.cell) return null;
  const today = await plantToday(tx, edit.tenantId);
  const day = (patch.effectiveFrom as string | undefined) ?? today;
  if (day > today)
    return { field: 'effectiveFrom', message: 'A cell change cannot be dated in the future' };
  const last = await latestMoveDate(tx, before.id as string);
  if (last && day < last) {
    return {
      field: 'effectiveFrom',
      message: `The machine's last move was on ${last}; date this one on or after it`,
    };
  }
  return null;
}

const SEGMENT_OFF: Problem = { field: 'segmentId', message: 'That segment is switched off' };

/** A machine is put in service in a segment (made, moved there, or switched back on) only while it is switched on. */
async function checkSegmentOn(tx: Db, m: Reply, edit?: Proposed): Promise<Problem | null> {
  const segmentId = m.segmentId as string | null | undefined;
  if (!segmentId || m.status === 'scrapped') return null;
  const switchedOn = edit?.patch.status !== undefined && edit.before.status === 'scrapped';
  const entering = !edit || 'segmentId' in edit.patch || switchedOn;
  return entering && !(await segmentIsOn(tx, segmentId)) ? SEGMENT_OFF : null;
}

async function checkMachine(tx: PoolClient, m: Reply, edit?: Proposed): Promise<Problem | null> {
  const links = (await checkLinks(tx, m, edit?.patch)) ?? (await checkSegmentOn(tx, m, edit));
  if (links || !edit) return links;
  if (edit.patch.status === 'scrapped' && edit.before.status !== 'scrapped') {
    const blocker = await machineSwitchOffBlocker(tx, edit.tenantId, edit.before.id as string);
    if (blocker) return { field: 'active', message: blocker, conflict: true };
  }
  return checkMoveDate(tx, edit);
}

/** A machine's first day in a new cell is today in the plant's own time zone unless the screen says so. */
async function recordMove(tx: Db, edit: Edit): Promise<void> {
  if (edit.before.cell === edit.after.cell) return;
  await insertMove(tx, {
    tenantId: edit.tenantId,
    machineId: edit.after.id as string,
    fromCell: edit.before.cell as string | null,
    toCell: edit.after.cell as string | null,
    effectiveFrom:
      (edit.patch.effectiveFrom as string | undefined) ?? (await plantToday(tx, edit.tenantId)),
  });
}

function machineAction(before: Reply, after: Reply): string {
  if (before.status !== 'scrapped' && after.status === 'scrapped') return 'machine.switch_off';
  if (before.status === 'scrapped' && after.status !== 'scrapped') return 'machine.switch_on';
  return 'machine.update';
}

const machines: Resource = {
  path: 'machines',
  table: 'machine',
  kind: 'machine',
  order: 'code',
  columns: {
    code: 'code',
    category: 'category',
    cell: 'cell',
    area: 'area',
    location: 'location',
    segmentId: 'segment_id',
    groupId: 'group_id',
    criticality: 'criticality',
    make: 'make',
    model: 'model',
    serial: 'serial',
    year: 'year',
    status: 'status',
  },
  fixed: ['criticality'],
  create: machineCreateSchema,
  patch: machinePatchSchema,
  switchTo: (active, before) => ({
    status: !active ? 'scrapped' : before.status === 'scrapped' ? 'active' : before.status,
  }),
  reply: machineReply,
  check: checkMachine,
  actionFor: machineAction,
  afterEdit: recordMove,
};

const segments: Resource = {
  path: 'segments',
  table: 'segment',
  kind: 'segment',
  order: 'sort, code',
  columns: {
    code: 'code',
    name: 'name',
    sort: 'sort',
    showOnBoard: 'show_on_board',
    groupBy: 'group_by',
    active: 'active',
  },
  create: segmentCreateSchema,
  patch: segmentPatchSchema,
  reply: (row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    sort: row.sort,
    showOnBoard: row.show_on_board,
    groupBy: row.group_by,
    active: row.active,
  }),
  fixed: ['code'],
  switchTo: (active) => ({ active }),
  check: async (tx, _merged, edit) => {
    if (edit?.patch.active !== false || edit.before.active === false) return null;
    return (await segmentHasLiveMachines(tx, edit.before.id as string))
      ? {
          field: 'active',
          message: 'Move or switch off the machines in this segment first',
          conflict: true,
        }
      : null;
  },
};

const groups: Resource = {
  path: 'groups',
  table: 'machine_group',
  kind: 'group',
  order: 'sort, code',
  columns: { segmentId: 'segment_id', code: 'code', name: 'name', sort: 'sort', hidden: 'hidden' },
  create: groupCreateSchema,
  patch: groupPatchSchema,
  reply: (row) => ({
    id: row.id,
    segmentId: row.segment_id,
    code: row.code,
    name: row.name,
    sort: row.sort,
    hidden: row.hidden,
    active: !row.hidden,
  }),
  fixed: ['code', 'segmentId'],
  switchTo: (active) => ({ hidden: !active }),
  check: async (tx, g, edit) => {
    const segmentId = g.segmentId as string;
    if (!(await exists(tx, 'segment', segmentId))) {
      return { field: 'segmentId', message: 'Unknown segment' };
    }
    const entering = !edit || edit.patch.hidden === false;
    return entering && !(await segmentIsOn(tx, segmentId)) ? SEGMENT_OFF : null;
  },
};

const shifts: Resource = {
  path: 'shifts',
  table: 'shift',
  kind: 'shift',
  order: 'code',
  columns: {
    code: 'code',
    name: 'name',
    startsAt: 'starts_at',
    endsAt: 'ends_at',
    active: 'active',
  },
  create: shiftCreateSchema,
  patch: shiftPatchSchema,
  reply: (row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    startsAt: clock(row.starts_at),
    endsAt: clock(row.ends_at),
    crossesMidnight: row.crosses_midnight,
    active: row.active,
  }),
  fixed: ['code'],
  switchTo: (active) => ({ active }),
  check: async (tx, s, edit) => {
    if (s.startsAt === s.endsAt) {
      return { field: 'endsAt', message: 'A shift cannot end when it starts' };
    }
    if (edit?.patch.active !== false || edit.before.active === false) return null;
    return (await hasOtherActiveShift(tx, edit.before.id as string))
      ? null
      : {
          field: 'active',
          message: 'A plant keeps at least one shift switched on',
          conflict: true,
        };
  },
  derive: (s) => ({ crosses_midnight: (s.endsAt as string) < (s.startsAt as string) }),
};

export const RESOURCES: readonly Resource[] = [machines, segments, groups, shifts];
