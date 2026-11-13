import { z } from 'zod';
import { refsByIds, ticketParents } from '../tickets/index.js';
import type { ImportCtx } from './batch.js';
import { provenanceRows } from './repo.js';
import { canonicalJson, canonicalSha256, SYNTHETIC_SOURCE } from './json.js';
import {
  makeRawEnvelope,
  messageOf,
  parseTicket,
  type AliasConfig,
  type BhavinTicket,
  type ImportIssue,
  type StoredRawPayload,
} from './schema.js';

export interface PlannedRow {
  rowNumber: number;
  raw: unknown;
  envelope: StoredRawPayload;
  ticket: BhavinTicket | null;
  outcome: 'import' | 'skip' | 'error';
  existingTicketId: string | null;
  parentId: string | null;
  parentRowNumber: number | null;
  issues: ImportIssue[];
  duplicateOf?: number;
  currentParentId?: string | null;
  syntheticExisting?: boolean;
}

interface Provenance {
  legacyId: string;
  ticketId: string | null;
  ref: string;
  identitySha256: string;
  status: 'imported' | 'skipped';
}

export function rowIssue(
  identity: { rowNumber: number; legacyId: string | null; ref: string | null },
  code: string,
  message: string,
  field: string | null = null,
): ImportIssue {
  return {
    ...identity,
    code,
    field,
    stored: null,
    computed: null,
    delta: null,
    severity: 'error',
    message,
  };
}

function envelope(raw: unknown, aliases: AliasConfig): StoredRawPayload {
  if (raw !== null) return makeRawEnvelope(raw, aliases);
  return {
    format: 'argus.import-raw/v1',
    raw,
    canonicalJson: canonicalJson(raw),
    rawSha256: canonicalSha256(raw),
    identitySha256: canonicalSha256({ ticket: raw, aliases }),
  };
}

function metadata(raw: unknown): { legacyId: string | null; ref: string | null } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { legacyId: null, ref: null };
  }
  const value = raw as Record<string, unknown>;
  return {
    legacyId: typeof value.legacyId === 'string' ? value.legacyId : null,
    ref: typeof value.ref === 'string' ? value.ref : null,
  };
}

function validationMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    return first ? `${first.message}` : 'Ticket validation failed';
  }
  return messageOf(error).slice(0, 1000);
}

async function existingTickets(ctx: ImportCtx) {
  const rows = await ticketParents(ctx.client, ctx.tenantId);
  return new Map(
    rows.map((row) => [
      row.ref as string,
      { id: row.id as string, parentId: row.parent_id as string | null },
    ]),
  );
}

async function provenance(ctx: ImportCtx): Promise<Provenance[]> {
  const rows = await provenanceRows(ctx.client, ctx.tenantId, SYNTHETIC_SOURCE);
  const refs = await refsByIds(
    ctx.client,
    ctx.tenantId,
    rows.map((row) => row.ticket_id as string).filter(Boolean),
  );
  return rows.map((row) => {
    const payload = row.payload as StoredRawPayload;
    if (payload?.format !== 'argus.import-raw/v1' || !payload.identitySha256) {
      throw new Error('Legacy import identity envelope is invalid');
    }
    if (!row.ticket_id && row.status === 'imported') {
      throw new Error(`Dangling imported identity: ${row.source_ref}`);
    }
    return {
      legacyId: row.source_ref as string,
      ticketId: row.ticket_id as string | null,
      ref: refs.get(row.ticket_id as string) ?? '',
      identitySha256: payload.identitySha256,
      status: row.status as 'imported' | 'skipped',
    };
  });
}

function existingIdentity(
  ticket: BhavinTicket,
  rawIdentity: string,
  tickets: Map<string, { id: string; parentId: string | null }>,
  provenance: Provenance[],
): Pick<PlannedRow, 'outcome' | 'existingTicketId' | 'syntheticExisting'> & { error?: string } {
  const identities = provenance.filter((row) => row.legacyId === ticket.legacyId && row.ticketId);
  if (identities.length) {
    const first = identities[0] as Provenance;
    const inconsistent = identities.some(
      (row) => row.identitySha256 !== first.identitySha256 || row.ref !== first.ref,
    );
    if (inconsistent)
      return { outcome: 'error', existingTicketId: null, error: 'ambiguous_legacy' };
    if (first.identitySha256 !== rawIdentity || first.ref !== ticket.ref) {
      return { outcome: 'error', existingTicketId: null, error: 'changed_payload' };
    }
    return { outcome: 'skip', existingTicketId: first.ticketId, syntheticExisting: true };
  }
  const existing = tickets.get(ticket.ref);
  if (!existing) return { outcome: 'import', existingTicketId: null, syntheticExisting: false };
  const otherLegacy = provenance.some(
    (row) => row.ticketId === existing.id && row.legacyId !== ticket.legacyId,
  );
  if (otherLegacy) {
    return { outcome: 'error', existingTicketId: null, error: 'imported_ref_other_legacy' };
  }
  const synthetic = provenance.some((row) => row.ticketId === existing.id);
  return {
    outcome: 'skip',
    existingTicketId: existing.id,
    syntheticExisting: synthetic,
  };
}

function planExisting(
  plan: PlannedRow,
  tickets: Map<string, { id: string; parentId: string | null }>,
  provenance: Provenance[],
): void {
  const ticket = plan.ticket as BhavinTicket;
  const existing = existingIdentity(ticket, plan.envelope.identitySha256, tickets, provenance);
  if (existing.error) {
    plan.outcome = 'error';
    plan.issues.push(
      rowIssue(
        { rowNumber: plan.rowNumber, legacyId: ticket.legacyId, ref: ticket.ref },
        existing.error,
        'Import identity conflict',
      ),
    );
    return;
  }
  plan.outcome = existing.outcome;
  plan.existingTicketId = existing.existingTicketId;
  plan.syntheticExisting = existing.syntheticExisting;
  plan.currentParentId = tickets.get(ticket.ref)?.parentId ?? null;
}

function planDuplicate(plan: PlannedRow, earlier: PlannedRow): void {
  if (
    plan.envelope.identitySha256 !== earlier.envelope.identitySha256 ||
    plan.ticket?.ref !== earlier.ticket?.ref
  ) {
    plan.outcome = 'error';
    plan.issues.push(
      rowIssue(
        {
          rowNumber: plan.rowNumber,
          legacyId: plan.ticket?.legacyId ?? null,
          ref: plan.ticket?.ref ?? null,
        },
        'in_file_identity_conflict',
        'Conflicting legacyId in one file',
      ),
    );
  } else {
    plan.duplicateOf = earlier.rowNumber;
  }
}

export async function planRows(
  ctx: ImportCtx,
  rows: unknown[],
  aliases: AliasConfig,
): Promise<PlannedRow[]> {
  const [tickets, imported] = await Promise.all([existingTickets(ctx), provenance(ctx)]);
  const plans: PlannedRow[] = [];
  const byLegacy = new Map<string, PlannedRow>();
  const byRef = new Map<string, PlannedRow>();
  for (const [index, raw] of rows.entries()) {
    const meta = metadata(raw);
    const plan: PlannedRow = {
      rowNumber: index + 1,
      raw,
      envelope: envelope(raw, aliases),
      ticket: null,
      outcome: 'error',
      existingTicketId: null,
      parentId: null,
      parentRowNumber: null,
      issues: [],
    };
    try {
      plan.ticket = parseTicket(raw);
      const legacy = plan.ticket.legacyId;
      const ref = plan.ticket.ref;
      const earlierLegacy = byLegacy.get(legacy);
      const earlierRef = byRef.get(ref);
      if (earlierLegacy) planDuplicate(plan, earlierLegacy);
      if (earlierRef && earlierRef !== earlierLegacy) {
        plan.outcome = 'error';
        plan.issues.push(
          rowIssue(
            { rowNumber: plan.rowNumber, legacyId: legacy, ref },
            'in_file_ref_conflict',
            'Conflicting ref in one file',
          ),
        );
      }
      if (!earlierLegacy && !earlierRef) planExisting(plan, tickets, imported);
      byLegacy.set(legacy, earlierLegacy ?? plan);
      byRef.set(ref, earlierRef ?? plan);
    } catch (error) {
      plan.outcome = 'error';
      plan.issues.push(
        rowIssue(
          { rowNumber: plan.rowNumber, legacyId: meta.legacyId, ref: meta.ref },
          'validation',
          validationMessage(error),
        ),
      );
    }
    plans.push(plan);
  }
  return plans;
}
