import { withTenant } from '@uptimo/db';
import type { Pool, PoolClient } from 'pg';
import { activePeople, ensurePendingPerson } from '../identity/index.js';
import { activeListItems, activeMachineByCode } from '../plant/index.js';
import {
  importTickets,
  lockRefCounter,
  raiseRefCounter,
  refCounterRows,
  setParent,
  ticketParents,
  type ImportedTicketRow,
} from '../tickets/index.js';
import { ImportFatalError, markBatchFatal, openBatch } from './batch.js';
import type { AfterImport } from './bhavin.js';
import { REAL_SOURCE, parseBhavinExport, type RealTicket } from './bhavin-export.js';
import { loadBatchSnapshot } from './fingerprint-sql.js';
import { makeCompletionFingerprint } from './fingerprint.js';
import { canonicalSha256, normalizeKey } from './json.js';
import { checkTicketFigures, type FigureCheck } from './real-oracle.js';
import { namesIn, toRow, type RowContext } from './real-rows.js';
import { personName } from './real-people.js';
import { finishBatch, insertPendingRow, provenanceRows, updateImportRow } from './repo.js';
import { makeRawEnvelope, type CompletionFingerprint } from './schema.js';

export interface RealImportStats {
  contract: typeof REAL_SOURCE;
  status: 'done' | 'failed';
  tickets: number;
  imported: number;
  skipped: number;
  events: number;
  crew: number;
  segments: number;
  reports: number;
  pendingPeople: number;
  figures: Record<FigureCheck['verdict'], number> & { differences: FigureCheck[] };
  refCounters: { BD: number; WR: number };
  fatal: { message: string } | null;
  completion: CompletionFingerprint | null;
}

const NO_ALIASES = { machines: {}, people: {}, maintenanceCodes: {} };

function summarise(checks: FigureCheck[]): RealImportStats['figures'] {
  const count = (verdict: FigureCheck['verdict']) =>
    checks.filter((c) => c.verdict === verdict).length;
  return {
    equal: count('equal'),
    edit: count('edit'),
    rule: count('rule'),
    timing: count('timing'),
    unexplained: count('unexplained'),
    differences: checks.filter((c) => c.verdict !== 'equal'),
  };
}

async function resolvePeople(
  tx: PoolClient,
  tenantId: string,
  tickets: RealTicket[],
): Promise<{ ids: Map<string, string>; pending: number }> {
  const ids = new Map<string, string>();
  for (const row of await activePeople(tx, tenantId)) {
    const key = normalizeKey(row.name);
    ids.set(key, ids.has(key) ? '' : row.id);
  }
  let pending = 0;
  for (const name of new Set(tickets.flatMap(namesIn))) {
    const key = normalizeKey(name);
    if (ids.get(key) === '') throw new Error('Ambiguous active person in the export');
    if (ids.has(key)) continue;
    ids.set(key, await ensurePendingPerson(tx, tenantId, name));
    pending += 1;
  }
  return { ids, pending };
}

async function context(
  tx: PoolClient,
  tenantId: string,
  tickets: RealTicket[],
): Promise<{ ctx: RowContext; pending: number; pausesSla: Map<string, boolean> }> {
  const { ids, pending } = await resolvePeople(tx, tenantId, tickets);
  const machines = new Map<string, ImportedTicketRow['machine']>();
  for (const code of new Set(tickets.filter((t) => t.kind !== 'general').map((t) => t.machine))) {
    const rows = await activeMachineByCode(tx, tenantId, code.toUpperCase());
    if (rows.length !== 1) throw new Error(`Unknown or inactive machine: ${code}`);
    const m = rows[0] as NonNullable<(typeof rows)[number]>;
    machines.set(code, {
      id: m.id,
      snapshot: { code: m.code, category: m.category, cell: m.cell },
      criticality: m.criticality ?? null,
    });
  }
  const pausesSla = new Map<string, boolean>();
  for (const item of await activeListItems(tx, tenantId, ['wait_reason'])) {
    pausesSla.set(normalizeKey(item.code as string), item.pauses_sla as boolean);
  }
  const personOf = (raw: string): string | null => {
    const name = personName(raw);
    return name ? (ids.get(normalizeKey(name)) ?? null) : null;
  };
  return { ctx: { personOf, machineOf: (code) => machines.get(code) ?? null }, pending, pausesSla };
}

function flagPauses(row: ImportedTicketRow, pausesSla: Map<string, boolean>): void {
  for (const e of row.events) {
    if (e.type === 'pause') {
      e.payload.pausesSla = pausesSla.get(normalizeKey(String(e.payload.reason))) ?? false;
    }
  }
}

async function linkParents(tx: PoolClient, tenantId: string, tickets: RealTicket[]): Promise<void> {
  const byRef = new Map(
    (await ticketParents(tx, tenantId)).map((r) => [r.ref as string, r.id as string]),
  );
  for (const t of tickets) {
    const parent = byRef.get(t.parentRef);
    const child = byRef.get(t.ref);
    if (t.parentRef && (!parent || !child)) throw new Error(`Missing parent ${t.parentRef}`);
    if (parent && child) await setParent(tx, { tenantId, childId: child, parentId: parent });
  }
}

async function advanceCounters(tx: PoolClient, tenantId: string, tickets: RealTicket[]) {
  const next = { BD: 1, WR: 1 };
  for (const prefix of ['BD', 'WR'] as const) {
    const counter = await refCounterRows(tx, tenantId, prefix);
    const used = tickets
      .filter((t) => t.ref.startsWith(`${prefix}-`))
      .map((t) => Number(t.ref.slice(3)));
    next[prefix] = Math.max(Number(counter[0]?.next_value ?? 1), ...used.map((n) => n + 1));
    await raiseRefCounter(tx, { tenantId, prefix, next: next[prefix] });
  }
  return next;
}

async function ledgerIdentity(
  tx: PoolClient,
  tenantId: string,
): Promise<Map<string, { ticketId: string; hash: string }>> {
  const found = new Map<string, { ticketId: string; hash: string }>();
  for (const r of await provenanceRows(tx, tenantId, REAL_SOURCE)) {
    if (r.ticket_id) {
      found.set(r.source_ref as string, {
        ticketId: r.ticket_id as string,
        hash: (r.payload as { identitySha256: string }).identitySha256,
      });
    }
  }
  return found;
}

interface Run {
  tx: PoolClient;
  tenantId: string;
  batchId: string;
  ctx: RowContext;
  pausesSla: Map<string, boolean>;
  known: Map<string, { ticketId: string; hash: string }>;
  stats: RealImportStats;
}

/** One ticket: its ledger row, then either "already loaded" (same identity) or the write. */
async function importOne(r: Run, t: RealTicket, rowNumber: number): Promise<void> {
  const { tx, tenantId, batchId, stats } = r;
  const envelope = makeRawEnvelope({ ...t, legacyId: t.id, entryType: 'ordinary' }, NO_ALIASES);
  const rowId = await insertPendingRow(tx, {
    tenantId,
    batchId,
    rowNumber,
    sourceRef: t.id,
    payload: JSON.stringify(envelope),
  });
  const before = r.known.get(t.id);
  if (before) {
    if (before.hash !== envelope.identitySha256) throw new Error(`Changed payload for ${t.ref}`);
    const ticketId = before.ticketId;
    await updateImportRow(tx, { rowId, tenantId, batchId, status: 'skipped', ticketId });
    stats.skipped += 1;
    return;
  }
  const row = toRow(t, r.ctx);
  flagPauses(row, r.pausesSla);
  const [ticketId] = await importTickets(tx, tenantId, [row]);
  await updateImportRow(tx, {
    rowId,
    tenantId,
    batchId,
    status: 'imported',
    ticketId: ticketId as string,
  });
  stats.imported += 1;
  stats.events += row.events.length;
  stats.crew += row.crew.length;
  stats.segments += row.segments.length;
  stats.reports += row.report ? 1 : 0;
}

function newStats(tickets: number, pending: number, figures: RealImportStats['figures']) {
  return {
    contract: REAL_SOURCE,
    status: 'done',
    tickets,
    imported: 0,
    skipped: 0,
    events: 0,
    crew: 0,
    segments: 0,
    reports: 0,
    pendingPeople: pending,
    figures,
    refCounters: { BD: 0, WR: 0 },
    fatal: null,
    completion: null,
  } satisfies RealImportStats;
}

async function run(
  pool: Pool,
  tenantId: string,
  batchId: string,
  input: { tickets: RealTicket[]; afterImport?: AfterImport },
): Promise<RealImportStats> {
  const { tickets } = input;
  const figures = summarise(tickets.flatMap(checkTicketFigures));
  if (figures.unexplained > 0) {
    throw new Error(
      `${figures.unexplained} stored figure(s) are not explained by the ticket's events`,
    );
  }
  return withTenant(pool, tenantId, async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`bhavin-import:${tenantId}`]);
    await lockRefCounter(tx, tenantId, 'BD');
    await lockRefCounter(tx, tenantId, 'WR');
    const { ctx, pending, pausesSla } = await context(tx, tenantId, tickets);
    const stats: RealImportStats = newStats(tickets.length, pending, figures);
    const known = await ledgerIdentity(tx, tenantId);
    const r: Run = { tx, tenantId, batchId, ctx, pausesSla, known, stats };
    for (const [index, t] of tickets.entries()) await importOne(r, t, index + 1);
    await linkParents(tx, tenantId, tickets);
    stats.refCounters = await advanceCounters(tx, tenantId, tickets);
    await input.afterImport?.(tx, tenantId);
    stats.completion = makeCompletionFingerprint(
      await loadBatchSnapshot(tx, tenantId, batchId, false),
    );
    await finishBatch(tx, {
      status: stats.status,
      stats: JSON.stringify(stats),
      batchId,
      tenantId,
    });
    return stats;
  });
}

/** Imports Bhavin's own `/api/export`: his numbers as recorded, proved against his arithmetic, all or nothing. */
export async function importRealExport(
  pool: Pool,
  tenantId: string,
  input: unknown,
  options: { afterImport?: AfterImport } = {},
): Promise<{ batchId: string; stats: RealImportStats }> {
  const tickets = parseBhavinExport(input).tickets.sort(
    (a, b) => a.downAt.localeCompare(b.downAt) || a.ref.localeCompare(b.ref),
  );
  const aliasSha256 = canonicalSha256(NO_ALIASES);
  const batchId = await openBatch(pool, tenantId, {
    ticketCount: tickets.length,
    aliasSha256,
    now: new Date(),
    contract: REAL_SOURCE,
  });
  try {
    return { batchId, stats: await run(pool, tenantId, batchId, { tickets, ...options }) };
  } catch (error) {
    await markBatchFatal(pool, tenantId, batchId, {
      ticketCount: tickets.length,
      aliasSha256,
      error,
    });
    throw new ImportFatalError(batchId, error);
  }
}
