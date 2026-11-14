import type { PoolClient } from 'pg';
import type { ZodTypeAny } from 'zod';
import {
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
  type Row,
  type Scope,
  type SettingsTable,
} from './repo/plant-settings.js';

type Db = Pick<PoolClient, 'query'>;
type Reply = Record<string, unknown>;
/** A rule the values break: 422 by default, 409 when the plant's own state is the reason. */
export type Problem = { field: string; message: string; conflict?: boolean };

/** One settings screen's resource: what the generic list, create and edit routes need to know. */
export interface Resource {
  path: string;
  table: SettingsTable;
  /** Set when one table holds several lists (`list_item`): only that list's rows are visible and written. */
  scope?: Scope;
  /** Prefix of the audit action: `machine.create`, `group.update`. */
  kind: string;
  order: string;
  /** Request key to column. A key not listed is never written. */
  columns: Record<string, string>;
  /** Keys a form may send back unchanged but never change (the code history names, a link with its own route). */
  fixed?: readonly string[];
  create: ZodTypeAny;
  patch: ZodTypeAny;
  /** The reply always carries `active`, the one switch the generated screen shows. */
  reply: (row: Row) => Reply;
  /** What `active: true/false` changes for this resource; none when it has no switch yet (ticket 29). */
  switchTo?: (active: boolean, before: Reply) => Reply;
  /** The values as they would be after the write; a message when they break a rule of the plant. */
  check?: (tx: PoolClient, merged: Reply, edit?: Proposed) => Promise<Problem | null>;
  /** Columns worked out from the values, never typed by a person. */
  derive?: (merged: Reply) => Record<string, unknown>;
  actionFor?: (before: Reply, after: Reply) => string;
  /** Runs inside the edit's transaction once the row is written. */
  afterEdit?: (tx: Db, edit: Edit) => Promise<void>;
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
    criticality: row.criticality,
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
async function plantToday(tx: Db, tenantId: string): Promise<string> {
  const { time_zone: timeZone } = await tenantInfo(tx, tenantId);
  return new Date().toLocaleDateString('en-CA', { timeZone });
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

async function checkMachine(tx: PoolClient, m: Reply, edit?: Proposed): Promise<Problem | null> {
  const links = await checkLinks(tx, m, edit?.patch);
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
    active: row.show_on_board,
  }),
  fixed: ['code'],
  switchTo: (active) => ({ showOnBoard: active }),
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
  check: async (tx, g) =>
    (await exists(tx, 'segment', g.segmentId as string))
      ? null
      : { field: 'segmentId', message: 'Unknown segment' },
};

const shifts: Resource = {
  path: 'shifts',
  table: 'shift',
  kind: 'shift',
  order: 'code',
  columns: { code: 'code', name: 'name', startsAt: 'starts_at', endsAt: 'ends_at' },
  create: shiftCreateSchema,
  patch: shiftPatchSchema,
  reply: (row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    startsAt: clock(row.starts_at),
    endsAt: clock(row.ends_at),
    crossesMidnight: row.crosses_midnight,
    active: true,
  }),
  fixed: ['code'],
  check: async (_tx, s) =>
    s.startsAt === s.endsAt
      ? { field: 'endsAt', message: 'A shift cannot end when it starts' }
      : null,
  derive: (s) => ({ crosses_midnight: (s.endsAt as string) < (s.startsAt as string) }),
};

export const RESOURCES: readonly Resource[] = [machines, segments, groups, shifts];
