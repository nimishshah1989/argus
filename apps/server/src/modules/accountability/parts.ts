import { type ConfigPart, type TicketPart } from '../../kernel/index.js';
import { loadSlaPolicies } from './repo/policies.js';
import { loadHandbacks } from './handback.js';
import { loadSlaProjections, projectTicketSla, reconcileTicket } from './sla.js';

export const slaTicketPart: TicketPart = {
  name: 'sla',
  load: (client, tenantId, ids, now) => loadSlaProjections(client, tenantId, ids, now),
  afterWrite: async (client, write) => {
    await reconcileTicket(client, write);
    return { sla: await projectTicketSla(client, write.tenantId, write.ticketId, write.now) };
  },
};

/** Production's sign-off of a fix. Reads after the `sla` part has re-armed the clocks, in the same transaction. */
export const handbackTicketPart: TicketPart = {
  name: 'handback',
  load: (client, tenantId, ids, now) => loadHandbacks(client, tenantId, ids, now),
  afterWrite: async (client, write) => ({
    handback:
      (await loadHandbacks(client, write.tenantId, [write.ticketId], write.now)).get(
        write.ticketId,
      ) ?? null,
  }),
};

export const slaPoliciesPart: ConfigPart = {
  name: 'slaPolicies',
  load: (client) => loadSlaPolicies(client),
};
