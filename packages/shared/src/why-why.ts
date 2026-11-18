import { z } from 'zod';
import { calendarDay } from './plant-settings.js';

/**
 * The Why-Why record of one closed breakdown (ticket 41, packet 41c-2, ruling R2): the five whys, the
 * conclusion, and the author and plant date the ticket home appends beside them. A person is an id, never a
 * name. The record is one append-only `ticket_event` of type `why_why`; the latest event wins.
 */

/** One why: at most 2,000 characters, and blank is allowed (a cause the team could not fill in). */
const why = z.string().max(2000);

const fields = {
  whys: z.tuple([why, why, why, why, why]),
  conclusion: z.string().trim().min(1).max(2000),
};

/** What a save may send: the whys and the conclusion. The author and the plant date are the server's. */
export const whyWhyWriteSchema = z.object(fields).strict();
export type WhyWhyWrite = z.infer<typeof whyWhyWriteSchema>;

/** The stored payload: the ticket home's shape with the author and plant date beside it. */
export const whyWhyPayloadSchema = z
  .object({
    ...fields,
    completedBy: z.string().uuid(),
    completedDate: calendarDay,
  })
  .strict();
export type WhyWhyPayload = z.infer<typeof whyWhyPayloadSchema>;
