import { z } from 'zod';

/** Server-bound schema; kept out of the runtime-free browser tag contract. */
export const tagApplySchema = z.object({ tagId: z.string().uuid() });
export type TagApplyBody = z.infer<typeof tagApplySchema>;

export const ticketIdSchema = z.string().uuid();
