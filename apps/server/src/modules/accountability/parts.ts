import { type ConfigPart, type TicketPart } from '../../kernel/index.js';
import { loadSlaPolicies } from './repo/policies.js';
import { loadSlaProjections, projectTicketSla, reconcileTicket } from './sla.js';

export const slaTicketPart: TicketPart = {
  name: 'sla',
  load: (client, tenantId, ids, now) => loadSlaProjections(client, tenantId, ids, now),
  afterWrite: async (client, write) => ({
    slaPolicyId: await reconcileTicket(client, write),
    sla: await projectTicketSla(client, write.tenantId, write.ticketId, write.now),
  }),
};

export const slaPoliciesPart: ConfigPart = {
  name: 'slaPolicies',
  load: (client) => loadSlaPolicies(client),
};
