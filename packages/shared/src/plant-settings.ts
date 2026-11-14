import { z } from 'zod';
import { criticalitySchema } from './config.js';

/**
 * Contracts for the plant-settings screens (tickets 22 and 23): machines, segments, groups, shifts,
 * the lists and the glossary. They follow what the generated `CrudPage` sends (D05): `GET` returns
 * `{ items, nextCursor }`; `POST` creates; `PUT /:id` edits and is also how a row is switched off and on
 * (`active`), never `DELETE`. A generated form sends every field as a string, so a number, a switch or an
 * id may arrive as text and an empty text means "none". Every key is camelCase.
 */

const blank = (v: unknown) => (v === '' ? null : v);
const num = (schema: z.ZodTypeAny) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : blank(v)), schema);
const flag = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());
const code = z.string().trim().min(1).max(40);
const name = z.string().trim().min(1).max(120);
const text = z.string().trim().max(120).nullable();
const id = z.string().uuid();
/** A path id that is not a uuid names no row: the routes answer 404 instead of asking the database. */
export const isUuid = (value: string): boolean => id.safeParse(value).success;
const nullableId = z.preprocess(blank, id.nullable());
const sort = num(z.number().int().min(0).max(9999));
/** A real calendar date: `2026-02-30` is refused, whether the engine rolls it over or calls it invalid. */
const isRealDay = (v: string): boolean => {
  const date = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
};
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-14')
  .refine(isRealDay, 'That date does not exist');
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 08:00');

/** What every settings list returns. Switch-off lists never page: a plant's lists are short. */
export const settingsPage = <T extends z.ZodTypeAny>(row: T) =>
  z.object({ items: z.array(row), nextCursor: z.null() }).strict();

export const machineStatusSchema = z.enum(['active', 'idle', 'scrapped']);
export type MachineStatus = z.infer<typeof machineStatusSchema>;

const machineFields = {
  category: text,
  cell: text,
  area: text,
  location: text,
  segmentId: nullableId,
  groupId: nullableId,
  make: text,
  model: text,
  serial: text,
  year: num(z.number().int().min(1900).max(2100).nullable()),
  status: machineStatusSchema,
};

/** A new machine. Criticality can be set here; afterwards it changes only through its own route. */
export const machineCreateSchema = z
  .object({ code, criticality: criticalitySchema.nullable(), ...machineFields })
  .partial()
  .required({ code: true })
  .strict();
export type MachineCreate = z.infer<typeof machineCreateSchema>;

/**
 * An edit. `effectiveFrom` dates a cell change (default today); it is read only when `cell` changes.
 * `criticality` may be sent back unchanged by a form but never changed here: `PUT /machines/:id/criticality`
 * also refreshes open tickets. `active: false` switches the machine off (`status: scrapped`).
 */
export const machinePatchSchema = z
  .object({
    code,
    criticality: z.preprocess(blank, criticalitySchema.nullable()),
    ...machineFields,
    effectiveFrom: day,
    active: flag,
  })
  .partial()
  .strict();
export type MachinePatch = z.infer<typeof machinePatchSchema>;

const activeField = { active: z.boolean() };

export const machineReplySchema = z
  .object({ id, code, ...machineFields, criticality: criticalitySchema.nullable(), ...activeField })
  .strict();
export type MachineReply = z.infer<typeof machineReplySchema>;

export const machineMoveReplySchema = z
  .object({
    id,
    machineId: id,
    fromCell: z.string().nullable(),
    toCell: z.string().nullable(),
    effectiveFrom: day,
  })
  .strict();
export type MachineMoveReply = z.infer<typeof machineMoveReplySchema>;

const segmentFields = {
  name,
  sort,
  showOnBoard: flag,
  groupBy: z.enum(['letters', 'category']),
};
export const segmentCreateSchema = z
  .object({ code, ...segmentFields })
  .partial({ sort: true, showOnBoard: true, groupBy: true })
  .strict();
/** `active` is "shown on the board": a segment has no other switch yet (ticket 29). */
export const segmentPatchSchema = z
  .object({ code, ...segmentFields, active: flag })
  .partial()
  .strict();
export const segmentReplySchema = z
  .object({ id, code, ...segmentFields, showOnBoard: z.boolean(), ...activeField })
  .strict();
export type SegmentCreate = z.infer<typeof segmentCreateSchema>;
export type SegmentPatch = z.infer<typeof segmentPatchSchema>;
export type SegmentReply = z.infer<typeof segmentReplySchema>;

const groupFields = { name, sort, hidden: flag };
export const groupCreateSchema = z
  .object({ segmentId: id, code, ...groupFields })
  .partial({ sort: true, hidden: true })
  .strict();
/** `active` is "not hidden". A group never moves to another segment: its machines would no longer match. */
export const groupPatchSchema = z
  .object({ segmentId: id, code, ...groupFields, active: flag })
  .partial()
  .strict();
export const groupReplySchema = z
  .object({ id, segmentId: id, code, ...groupFields, hidden: z.boolean(), ...activeField })
  .strict();
export type GroupCreate = z.infer<typeof groupCreateSchema>;
export type GroupPatch = z.infer<typeof groupPatchSchema>;
export type GroupReply = z.infer<typeof groupReplySchema>;

const shiftTimes = { startsAt: clock, endsAt: clock };
/** `crossesMidnight` is worked out from the two times, never typed. A shift code is fixed once made: history names it. */
export const shiftCreateSchema = z.object({ code, name, ...shiftTimes }).strict();
/** A shift has no switch-off column yet (ticket 29): `active: false` is refused, `true` is accepted. */
export const shiftPatchSchema = z
  .object({ code, name, ...shiftTimes, active: flag })
  .partial()
  .strict();
export const shiftReplySchema = z
  .object({ id, code, name, ...shiftTimes, crossesMidnight: z.boolean(), ...activeField })
  .strict();
export type ShiftCreate = z.infer<typeof shiftCreateSchema>;
export type ShiftPatch = z.infer<typeof shiftPatchSchema>;
export type ShiftReply = z.infer<typeof shiftReplySchema>;

const listFields = {
  label: name,
  labelGu: text,
  labelHi: text,
  sort,
  isVendor: flag,
  pausesSla: flag,
  tag: z.string().trim().max(40).nullable(),
};
/** One entry of a list (wait reason, work type, quick problem ...). Its code is fixed once made: tickets keep it. */
export const listItemCreateSchema = z
  .object({ code, ...listFields, active: flag })
  .partial()
  .required({ code: true, label: true })
  .strict();
export const listItemPatchSchema = z
  .object({ code, ...listFields, active: flag })
  .partial()
  .strict();
export const listItemReplySchema = z
  .object({
    id,
    code,
    ...listFields,
    sort: z.number(),
    isVendor: z.boolean(),
    pausesSla: z.boolean(),
    ...activeField,
  })
  .strict();
export type ListItemCreate = z.infer<typeof listItemCreateSchema>;
export type ListItemPatch = z.infer<typeof listItemPatchSchema>;
export type ListItemReply = z.infer<typeof listItemReplySchema>;

const glossaryFields = {
  source: z.string().trim().min(1).max(200),
  english: z.string().trim().min(1).max(200),
  direction: z.enum(['gu', 'gu-Latn', 'en']),
};
export const glossaryCreateSchema = z.object(glossaryFields).partial({ direction: true }).strict();
/** A glossary term has no switch-off column yet (ticket 29): `active: false` is refused, `true` accepted. */
export const glossaryPatchSchema = z
  .object({ ...glossaryFields, active: flag })
  .partial()
  .strict();
export const glossaryReplySchema = z.object({ id, ...glossaryFields, ...activeField }).strict();
export type GlossaryCreate = z.infer<typeof glossaryCreateSchema>;
export type GlossaryPatch = z.infer<typeof glossaryPatchSchema>;
export type GlossaryReply = z.infer<typeof glossaryReplySchema>;

/** The company profile settings (`PUT /settings/company.*`). The time zone is checked against the real zone list. */
export const companyNameSchema = z.string().trim().min(1).max(120);
export const companyLanguageSchema = z.enum(['en', 'gu', 'hi']);
export const companyTimeZoneSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/, 'Use a zone like Asia/Kolkata')
  .refine((zone) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  }, 'Unknown time zone');

/** The logo upload: raw image bytes, PNG, JPEG or WebP, at most 256 KB. */
export const LOGO_MAX_BYTES = 256 * 1024;
export const logoReplySchema = z.object({ logo: z.string() }).strict();
