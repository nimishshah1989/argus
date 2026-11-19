import { z } from 'zod';
import { criticalitySchema } from './config.js';
import { blank, dropBlanks, flag, num } from './form.js';

/**
 * Contracts for the plant-settings screens (tickets 22 and 23): machines, segments, groups, shifts,
 * the lists and the glossary. They follow what the generated `CrudPage` sends (D05): `GET` returns
 * `{ items, nextCursor }`; `POST` creates; `PUT /:id` edits and is also how a row is switched off and on
 * (`active`), never `DELETE`. A generated form sends every field as a string, so a number, a switch or an
 * id may arrive as text and an empty text means "none". Every key is camelCase.
 */

const code = z.string().trim().min(1).max(40);
const name = z.string().trim().min(1).max(120);
const text = z.string().trim().max(120).nullable();
const id = z.string().uuid();
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
/** The same real calendar date, for the settings contracts of other modules (the duty roster). */
export { day as calendarDay };
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

/**
 * The lock's rule that criticality starts at B for every machine. A new machine gets it from the create
 * schema; a machine stored before the rule (a null) is read as B, which is the legacy default.
 */
export const DEFAULT_MACHINE_CRITICALITY = 'B' as const;

/** A new machine. Criticality can be set here; afterwards it changes only through its own route. */
export const machineCreateSchema = dropBlanks(
  z
    .object({ code, criticality: criticalitySchema.nullable(), ...machineFields })
    .partial()
    .required({ code: true })
    // Set after `.partial()`: a field-level default made optional by `.partial()` never runs, so a form
    // that leaves criticality empty would store a null instead of the lock's B.
    .extend({ criticality: criticalitySchema.nullable().default(DEFAULT_MACHINE_CRITICALITY) })
    .strict(),
);
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

/**
 * `PUT /machines/:id/production-data` (ticket 77a): the plant switches one machine to "not counted in production data"
 * (`true`) or back (`false`). Its breakdowns stay on record and keep counting in the manpower hours and the energy
 * list, and leave BD %, MTTR, MTBF, availability and the other production figures.
 */
export const machineProductionPatchSchema = z.object({ excludedFromProduction: flag }).strict();
export type MachineProductionPatch = z.infer<typeof machineProductionPatchSchema>;

export const machineProductionReplySchema = z
  .object({ id, code, excludedFromProduction: z.boolean() })
  .strict();
export type MachineProductionReply = z.infer<typeof machineProductionReplySchema>;

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
export const segmentCreateSchema = dropBlanks(
  z
    .object({ code, ...segmentFields })
    .partial({ sort: true, showOnBoard: true, groupBy: true })
    .strict(),
);
/** `active: false` switches a segment off (refused while machines in it are in service). Hide it from the board only with `showOnBoard`. */
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
export const groupCreateSchema = dropBlanks(
  z
    .object({ segmentId: id, code, ...groupFields })
    .partial({ sort: true, hidden: true })
    .strict(),
);
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
export const shiftCreateSchema = dropBlanks(z.object({ code, name, ...shiftTimes }).strict());
/** `active: false` switches a shift off: new reports and the board's config stop using it, history keeps it. */
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

/**
 * A list entry's old codes (ticket 47): a generated form sends one comma-separated text (`'ele, hyd'`), an
 * array, or nothing, and every shape is stored and read back as a trimmed, lower-case array. The 0014 trigger
 * refuses a code or alias another entry of the same list claims, in any letter case.
 */
const aliases = z.preprocess(
  (value) => {
    const parts = typeof value === 'string' ? value.split(',') : value;
    if (!Array.isArray(parts)) return value;
    return parts
      .map((alias) => (typeof alias === 'string' ? alias.trim().toLowerCase() : alias))
      .filter((alias) => alias !== '');
  },
  z.array(z.string().min(1).max(40)),
);

/** A list's label may be a whole description (the failure codes' "NO DT" is 121 characters), not only a short name. */
const listLabel = z.string().trim().min(1).max(200);

const listFields = {
  label: listLabel,
  labelGu: text,
  labelHi: text,
  sort,
  isVendor: flag,
  pausesSla: flag,
  tag: z.string().trim().max(40).nullable(),
  /** Only on a work type or a breakdown category: a ticket carrying it needs the lockout steps confirmed before Start. */
  needsLockout: flag,
  /** The old codes folded onto this entry; edited on the failure-code list, a key of every list's reply. */
  aliases,
};
/** One entry of a list (wait reason, work type, quick problem ...). Its code is fixed once made: tickets keep it. */
export const listItemCreateSchema = dropBlanks(
  z
    .object({ code, ...listFields, active: flag })
    .partial()
    .required({ code: true, label: true })
    .strict(),
);
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
    needsLockout: z.boolean(),
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
export const glossaryCreateSchema = dropBlanks(
  z.object(glossaryFields).partial({ direction: true }).strict(),
);
/** `active: false` switches a glossary term off. */
export const glossaryPatchSchema = z
  .object({ ...glossaryFields, active: flag })
  .partial()
  .strict();
export const glossaryReplySchema = z.object({ id, ...glossaryFields, ...activeField }).strict();
export type GlossaryCreate = z.infer<typeof glossaryCreateSchema>;
export type GlossaryPatch = z.infer<typeof glossaryPatchSchema>;
export type GlossaryReply = z.infer<typeof glossaryReplySchema>;

/** The four kinds of one asset register row (0015's CHECK): AMC, warranty, a statutory test or a calibration. */
export const ASSET_KINDS = ['amc', 'warranty', 'legal', 'calibration'] as const;
export const assetKindSchema = z.enum(ASSET_KINDS);
export type AssetKind = z.infer<typeof assetKindSchema>;

/** The platform's default reminder window: an imported or new register row watches 15 days ahead (R8/R13). */
export const REGISTER_LEAD_DAYS = 15;

const registerText = (max: number) => z.string().trim().max(max).nullable();
const registerDay = z.preprocess(blank, day.nullable());

const registerFields = {
  kind: assetKindSchema,
  machineId: nullableId,
  vendor: registerText(120),
  reference: registerText(120),
  startsOn: registerDay,
  endsOn: registerDay,
  dueOn: registerDay,
  leadDays: num(z.number().int().min(0).max(3650)),
  ownerPersonId: nullableId,
  notes: registerText(500),
};

/** A new register row: the kind is required, the lead defaults to the platform's 15 days. */
export const assetRegisterCreateSchema = dropBlanks(
  z
    .object(registerFields)
    .partial()
    .required({ kind: true })
    // Set after `.partial()`: a field-level default made optional by `.partial()` never runs (the machine's rule).
    .extend({ leadDays: num(z.number().int().min(0).max(3650)).default(REGISTER_LEAD_DAYS) })
    .strict(),
);
export type AssetRegisterCreate = z.infer<typeof assetRegisterCreateSchema>;

/**
 * An edit. `active: false` is the generic remove path (the row goes, the audit keeps it); the screen sends the
 * reason with the switch and the server records it on the audit line alone (R7).
 */
const registerReason = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().max(500).optional(),
);
export const assetRegisterPatchSchema = z
  .object({ ...registerFields, active: flag, reason: registerReason })
  .partial()
  .strict();
export type AssetRegisterPatch = z.infer<typeof assetRegisterPatchSchema>;

/** What a listed row carries: `active: true`, and the remove reply `{...before, active:false}` also validates. */
export const assetRegisterReplySchema = z
  .object({
    id,
    kind: assetKindSchema,
    machineId: id.nullable(),
    vendor: registerText(120),
    reference: registerText(120),
    startsOn: day.nullable(),
    endsOn: day.nullable(),
    dueOn: day.nullable(),
    leadDays: z.number().int(),
    ownerPersonId: id.nullable(),
    notes: registerText(500),
    active: z.boolean(),
  })
  .strict();
export type AssetRegisterReply = z.infer<typeof assetRegisterReplySchema>;

/** The company profile settings (`PUT /settings/company.*`). The time zone is checked against the real zone list. */
export const companyNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((v) => !/\p{Cc}/u.test(v), 'The name cannot contain control characters');
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
