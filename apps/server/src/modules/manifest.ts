// Module manifest (ticket 03): pure data that tools/check-boundaries.ts enforces. No imports.

/** Tables each module owns; only that module's repo.ts (or repo/ folder) may name them in SQL. */
export const OWNERS: Readonly<Record<string, readonly string[]>> = {
  ops: ['audit_log', 'audit_purge'],
  identity: [
    'tenant',
    'person',
    'login',
    'session',
    'platform_access',
    'auth_lookup',
    'tenant_by_slug',
    'tenant_info',
    'tenant_update_profile',
    'tenant_set_logo',
    'tenant_logo',
    'job_tenant_ids',
    'erase_person',
    'erase_json_values',
    'offboard_tenant',
    'platform_access_guard',
  ],
  people: [],
  plant: [
    'segment',
    'machine_group',
    'machine',
    'machine_move',
    'list_item',
    'shift',
    'setting',
    'glossary_term',
    'ui_translation',
  ],
  files: ['file'],
  notifications: ['push_subscription', 'notification'],
  accountability: ['sla_policy', 'sla_timer', 'roster_entry', 'escalation_rule'],
  reports: [],
  tickets: [
    'ticket',
    'ticket_event',
    'crew_member',
    'work_segment',
    'breakdown_report',
    'breakdown_report_person',
    'command_idempotency',
    'ref_counter',
    'import_undo',
  ],
  imports: ['import_batch', 'import_row'],
  ai: ['ai_suggestion'],
};

/** Which modules each module may call (through their index.ts). Acyclic, bottom-up. */
export const CALLS: Readonly<Record<string, readonly string[]>> = {
  ops: [],
  identity: ['ops'],
  plant: ['identity', 'files', 'ops'],
  people: ['identity', 'notifications', 'plant', 'tickets', 'ops'],
  files: ['identity', 'ops'],
  notifications: ['identity', 'plant', 'ops'],
  tickets: ['identity', 'plant', 'files', 'ops'],
  accountability: ['tickets', 'identity', 'plant', 'notifications', 'ops'],
  reports: ['tickets', 'identity', 'plant', 'files'],
  imports: ['tickets', 'identity', 'plant', 'files', 'ops'],
  ai: ['tickets', 'identity', 'plant'],
};

/** A call outside CALLS that stays until its ticket removes it; `file` is repo-relative. */
export interface CallException {
  file: string;
  module: string;
  until: string;
}

export const EXCEPTIONS: readonly CallException[] = [];
