import { z } from 'zod';

export const raiseTicketSchema = z.object({
  machineId: z.string().uuid(),
  problem: z.string().min(1).max(2000),
  kind: z.enum(['stopped', 'support']).default('stopped'),
  reportedByPersonId: z.string().uuid().optional(),
  startNow: z.boolean().optional(),
});
export type RaiseTicketBody = z.infer<typeof raiseTicketSchema>;
