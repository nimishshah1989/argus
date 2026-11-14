import { z } from 'zod';

/** One closed ticket still waiting for production to confirm or dispute the fix. */
export const signoffFeedItemSchema = z
  .object({
    ticketId: z.string(),
    ref: z.string(),
    machine: z.object({ id: z.string(), code: z.string().nullable() }).strict().nullable(),
    /** The cell the machine was in when the ticket was reported, null when it had none. */
    cell: z.string().nullable(),
    closedAt: z.string(),
    /** When production was asked: the same instant as the close. */
    requestedAt: z.string(),
    /** When the time to answer runs out, null when the plant sets no limit. */
    dueAt: z.string().nullable(),
  })
  .strict();

/** `GET /board/signoff`: newest close first, at most `SIGNOFF_FEED_MAX` items. */
export const signoffFeedReplySchema = z.object({ items: z.array(signoffFeedItemSchema) }).strict();
export type SignoffFeed = z.infer<typeof signoffFeedReplySchema>;
export const SIGNOFF_FEED_MAX = 50;
