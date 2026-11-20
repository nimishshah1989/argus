import type { EntityKind, EntityRef } from '../../../ui/v2/entity-chip.js';

/**
 * Where each kind of thing has its page: the one place that says so. A decision has no page of its own, so it is the
 * Action Center with it open; a cell is the machines register filtered to it. Screens that are rebuilt later keep
 * these paths, and this table does not change when they do.
 */
const PAGES: Record<EntityKind, (id: string) => string> = {
  machine: (id) => `/analytics/machines/${id}`,
  decision: (id) => `/analytics/today/action-center?drawer=decision:${id}`,
  person: (id) => `/analytics/today?screen=team-focus&drawer=person:${id}`,
  cell: (id) => `/analytics/machines?cell=${id}`,
};

export function entityHref({ kind, id }: EntityRef): string {
  return PAGES[kind](encodeURIComponent(id));
}
