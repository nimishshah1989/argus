import type { AuditRow } from '@uptimo/shared/audit';

let n = 0;
export const change = (at: string, entity: string, by: string | null): AuditRow => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  at,
  action: 'update',
  entity,
  entityId: null,
  actor: by === null ? null : { loginId: `l-${by}`, name: by },
  before: null,
  after: null,
  ip: null,
});

export const NOW = new Date('2026-11-25T12:00:00.000Z');
