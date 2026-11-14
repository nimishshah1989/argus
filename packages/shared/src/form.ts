import { z } from 'zod';

/**
 * What a generated settings form sends (D05, `CrudPage`): every field as text, an empty text meaning "none".
 * These coercers are the one place that rule lives, so a second resource family adopts it without copying.
 */

/** An empty text is "none". */
export const blank = (v: unknown): unknown => (v === '' ? null : v);

/** A number typed in a form: "7" is 7, "" is none. */
export const num = (schema: z.ZodTypeAny) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : blank(v)), schema);

/** A switch typed in a form: "true" and "false" are the booleans. */
export const flag = z.preprocess(
  (v) => (v === 'true' ? true : v === 'false' ? false : v),
  z.boolean(),
);

/** On create an empty text is a field that was not sent, so its default applies. */
export const dropBlanks = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).filter(([, value]) => value !== ''))
        : v,
    schema,
  );

/** A path id that is not a uuid names no row: the routes answer 404 instead of asking the database. */
export const isUuid = (value: string): boolean => z.string().uuid().safeParse(value).success;
