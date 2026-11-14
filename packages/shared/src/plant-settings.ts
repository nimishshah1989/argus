import { z } from 'zod';
import { criticalitySchema } from './config.js';

/**
 * Contracts for the plant-settings screens (ticket 22): machines, segments, groups and shifts. One shape
 * per verb (create, edit) and one for what a read returns, so a generated screen takes its fields from
 * here. Every key is camelCase. Nothing here deletes: a machine is switched off by its `status`.
 */

const code = z.string().trim().min(1).max(40);
const name = z.string().trim().min(1).max(120);
const text = z.string().trim().max(120).nullable();
const id = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-14');
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 08:00');

export const machineStatusSchema = z.enum(['active', 'idle', 'scrapped']);
export type MachineStatus = z.infer<typeof machineStatusSchema>;

const machineFields = {
  category: text,
  cell: text,
  area: text,
  location: text,
  segmentId: id.nullable(),
  groupId: id.nullable(),
  make: text,
  model: text,
  serial: text,
  year: z.number().int().min(1900).max(2100).nullable(),
  status: machineStatusSchema,
};

/** A new machine. Criticality can be set here; afterwards it changes only through its own route. */
export const machineCreateSchema = z
  .object({ code, criticality: criticalitySchema.nullable(), ...machineFields })
  .partial({
    criticality: true,
    category: true,
    cell: true,
    area: true,
    location: true,
    segmentId: true,
    groupId: true,
    make: true,
    model: true,
    serial: true,
    year: true,
    status: true,
  })
  .strict();
export type MachineCreate = z.infer<typeof machineCreateSchema>;

/**
 * An edit. `effectiveFrom` dates a cell change (default today); it is read only when `cell` changes.
 * Criticality is not here: it has `PUT /machines/:id/criticality`, which also refreshes open tickets.
 */
export const machinePatchSchema = z
  .object({ code, ...machineFields, effectiveFrom: day })
  .partial()
  .strict();
export type MachinePatch = z.infer<typeof machinePatchSchema>;

export const machineReplySchema = z
  .object({
    id,
    code,
    ...machineFields,
    criticality: criticalitySchema.nullable(),
  })
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
  sort: z.number().int().min(0).max(9999),
  showOnBoard: z.boolean(),
  groupBy: z.enum(['letters', 'category']),
};
export const segmentCreateSchema = z
  .object({ code, ...segmentFields })
  .partial({ sort: true, showOnBoard: true, groupBy: true })
  .strict();
export const segmentPatchSchema = z.object(segmentFields).partial().strict();
export const segmentReplySchema = z.object({ id, code, ...segmentFields }).strict();
export type SegmentCreate = z.infer<typeof segmentCreateSchema>;
export type SegmentPatch = z.infer<typeof segmentPatchSchema>;
export type SegmentReply = z.infer<typeof segmentReplySchema>;

const groupFields = { name, sort: z.number().int().min(0).max(9999), hidden: z.boolean() };
export const groupCreateSchema = z
  .object({ segmentId: id, code, ...groupFields })
  .partial({ sort: true, hidden: true })
  .strict();
/** A group never moves to another segment: its machines would no longer match it. */
export const groupPatchSchema = z.object(groupFields).partial().strict();
export const groupReplySchema = z.object({ id, segmentId: id, code, ...groupFields }).strict();
export type GroupCreate = z.infer<typeof groupCreateSchema>;
export type GroupPatch = z.infer<typeof groupPatchSchema>;
export type GroupReply = z.infer<typeof groupReplySchema>;

const shiftTimes = { startsAt: clock, endsAt: clock };
/** `crossesMidnight` is worked out from the two times, never typed. A shift code is fixed once made: history names it. */
export const shiftCreateSchema = z.object({ code, name, ...shiftTimes }).strict();
export const shiftPatchSchema = z
  .object({ name, ...shiftTimes })
  .partial()
  .strict();
export const shiftReplySchema = z
  .object({ id, code, name, ...shiftTimes, crossesMidnight: z.boolean() })
  .strict();
export type ShiftCreate = z.infer<typeof shiftCreateSchema>;
export type ShiftPatch = z.infer<typeof shiftPatchSchema>;
export type ShiftReply = z.infer<typeof shiftReplySchema>;
