import { z } from 'zod';
import { figureReplySchema } from './analytics.js';
import { calendarDay } from './plant-settings.js';

/**
 * Compare any two machines (ticket 585, ADR 0021): `GET /analytics/compare?a=<code>&b=<code>&asOf=YYYY-MM-DD`. No `a`
 * and `b`: the engine's own pair. The reply carries the engine's Compare figure for the pair exactly as
 * `/analytics/figures` carries `compare`, the codes the picker offers, each machine's year so far, and the value of a
 * machine hour for money roles only.
 */

/** A machine code as the plant writes it. */
const machineCode = z.string().trim().min(1).max(40);

/** The query; `a` and `b` come together or not at all (the route answers 422 naming the missing one). */
export const compareQuerySchema = z
  .object({ a: machineCode.optional(), b: machineCode.optional(), asOf: calendarDay.optional() })
  .strict();
export type CompareQuery = z.infer<typeof compareQuerySchema>;

/** One machine's year so far: the domain's `PairYear`. */
export const pairYearSchema = z
  .object({
    machineId: z.string(),
    code: z.string(),
    category: z.string().nullable(),
    cell: z.string().nullable(),
    age: z.number().nullable(),
    count: z.number().int().nonnegative(),
    hours: z.number().nonnegative(),
    plannedHours: z.number().nonnegative(),
    causes: z.array(
      z
        .object({
          code: z.string(),
          count: z.number().int().nonnegative(),
          hours: z.number().nonnegative(),
        })
        .strict(),
    ),
    weekly: z.array(z.number().nonnegative()).length(12),
    last: z
      .object({ count: z.number().int().nonnegative(), hours: z.number().nonnegative() })
      .strict(),
  })
  .strict();
export type PairYearReply = z.infer<typeof pairYearSchema>;

/**
 * The reply. A plant with no comparison: `pair` and `years` null, `options` empty, `figure.value` null. `rate` is the
 * profile's `mmThroughput` (rupees a machine hour) for heads and admin, null for everyone else; for them the checkup
 * table also leaves out its two "Spares cost" rows.
 */
export const compareReplySchema = z
  .object({
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    pair: z.object({ a: z.string(), b: z.string() }).strict().nullable(),
    options: z.array(z.string()),
    figure: figureReplySchema,
    years: z.tuple([pairYearSchema, pairYearSchema]).nullable(),
    rate: z.number().nullable(),
  })
  .strict();
export type CompareReply = z.infer<typeof compareReplySchema>;
