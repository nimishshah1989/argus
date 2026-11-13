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
    'erase_person',
    'erase_json_values',
    'offboard_tenant',
    'platform_access_guard',
  ],
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
  notifications: ['push_subscription'],
  accountability: ['sla_policy', 'sla_timer'],
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
  ],
  imports: ['import_batch', 'import_row', 'import_undo'],
};

/** Which modules each module may call (through their index.ts). Acyclic, bottom-up. */
export const CALLS: Readonly<Record<string, readonly string[]>> = {
  ops: [],
  identity: ['ops'],
  plant: ['identity', 'ops'],
  files: ['ops'],
  notifications: ['identity', 'plant', 'ops'],
  tickets: ['identity', 'plant', 'files', 'ops'],
  accountability: ['tickets', 'identity', 'plant', 'notifications', 'ops'],
  reports: ['tickets', 'identity', 'plant', 'files'],
  imports: ['tickets', 'identity', 'plant', 'files', 'ops'],
};

/** A call outside CALLS that stays until its ticket removes it; `file` is repo-relative. */
export interface CallException {
  file: string;
  module: string;
  until: string;
}

export const EXCEPTIONS: readonly CallException[] = [
  {
    file: 'apps/server/src/modules/plant/service.ts',
    module: 'accountability',
    until: 'ticket 04: SLA policies leave /config',
  },
  {
    file: 'apps/server/src/modules/tickets/routes.ts',
    module: 'accountability',
    until: 'ticket 04: sla reply part',
  },
  {
    file: 'apps/server/src/modules/tickets/list.ts',
    module: 'accountability',
    until: 'ticket 04: sla reply part',
  },
  {
    file: 'apps/server/src/modules/imports/bhavin.ts',
    module: 'accountability',
    until: 'ticket 09: importer rewrite',
  },
  {
    file: 'apps/server/src/modules/imports/cli.ts',
    module: 'accountability',
    until: 'ticket 09: importer rewrite',
  },
];
