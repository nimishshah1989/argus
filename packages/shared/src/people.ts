import { z } from 'zod';
import { blank, dropBlanks, flag } from './form.js';
import { settingsPage } from './plant-settings.js';

/**
 * Contracts for the people and logins screens (ticket 21). They follow what the generated `CrudPage` sends (D05,
 * same as the plant settings): `GET` returns `{ items, nextCursor }`; `POST` creates and answers the row; `PUT
 * /:id` edits and is also how a person or login is switched off and on (`active`), never `DELETE`. A form sends
 * every field as text, so a switch may arrive as "true" and an empty text means "none".
 */

/** E.164: `+`, then 8 to 15 digits, the first not 0. No spaces, dashes or brackets. */
export const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
export const PHONE_MESSAGE =
  'Use the international format: + then the country code and the number, digits only (for example +919876543210)';

export const LOGIN_ROLES = [
  'operator',
  'technician',
  'supervisor',
  'head',
  'plant_head',
  'admin',
  'board',
] as const;

const phone = z
  .string()
  .refine((v) => v === '' || E164_PATTERN.test(v), PHONE_MESSAGE)
  .transform((v) => (v === '' ? null : v))
  .nullable();

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable();

const team = z.enum(['maintenance', 'production', 'vendor']);
const nonEmpty = (o: object) => Object.keys(o).length > 0;

const personFields = {
  name: text(120),
  shortName: optionalText(40),
  phone,
  team,
  title: optionalText(60),
  cell: optionalText(60),
  defaultShift: optionalText(20),
};

export const personCreateSchema = dropBlanks(
  z.object(personFields).partial().required({ name: true, team: true }).strict(),
);
export type PersonCreate = z.infer<typeof personCreateSchema>;

/** `active: false` switches the person off, `true` back on. A form may send every field back unchanged. */
export const personPatchSchema = z
  .object({ ...personFields, active: flag })
  .partial()
  .strict()
  .refine(nonEmpty, 'Nothing to change');
export type PersonPatch = z.infer<typeof personPatchSchema>;

export const personAdminSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    shortName: z.string().nullable(),
    phone: z.string().nullable(),
    team,
    title: z.string().nullable(),
    cell: z.string().nullable(),
    defaultShift: z.string().nullable(),
    active: z.boolean(),
    pending: z.boolean(),
  })
  .strict();
export type PersonAdmin = z.infer<typeof personAdminSchema>;

const username = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9._-]{2,59}$/,
    'Use 3 to 60 lowercase letters, digits, dots, dashes or underscores',
  );
const temporaryPassword = z.string().min(1).max(200);
const role = z.enum(LOGIN_ROLES);
const personId = z.preprocess(blank, z.string().uuid().nullable());

export const loginCreateSchema = dropBlanks(
  z
    .object({
      username,
      role,
      shared: flag,
      personId: personId.optional(),
      cell: optionalText(60).optional(),
      temporaryPassword,
    })
    .strict()
    .superRefine((v, ctx) => {
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });
      if (v.shared && v.personId) issue('personId', 'A shared login has no person');
      if (!v.shared && !v.personId) issue('personId', 'A personal login needs a person');
      if (!v.shared && v.cell) issue('cell', 'Only a shared login has a cell');
    }),
);
export type LoginCreate = z.infer<typeof loginCreateSchema>;

/**
 * `active: false` switches a login off; switching on needs a new `temporaryPassword`, and an empty one means
 * none. `username`, `shared` and `personId` are fixed: a form may send them back, never change them.
 */
export const loginPatchSchema = z
  .object({
    role,
    cell: optionalText(60),
    active: flag,
    temporaryPassword: z.preprocess(
      (v) => (v === '' ? undefined : v),
      temporaryPassword.optional(),
    ),
    username: z.string(),
    shared: flag,
    personId,
  })
  .partial()
  .strict()
  .refine(nonEmpty, 'Nothing to change');
export type LoginPatch = z.infer<typeof loginPatchSchema>;

export const loginAdminSchema = z
  .object({
    id: z.string(),
    username: z.string(),
    role,
    shared: z.boolean(),
    personId: z.string().nullable(),
    cell: z.string().nullable(),
    mustChangePassword: z.boolean(),
    active: z.boolean(),
  })
  .strict();
export type LoginAdmin = z.infer<typeof loginAdminSchema>;

/** Reply schema of each people-and-logins route, spread into `REPLY_SCHEMAS`. */
export const PEOPLE_REPLIES = {
  'GET /api/v1/people': settingsPage(personAdminSchema),
  'POST /api/v1/people': personAdminSchema,
  'PUT /api/v1/people/:id': personAdminSchema,
  'GET /api/v1/logins': settingsPage(loginAdminSchema),
  'POST /api/v1/logins': loginAdminSchema,
  'PUT /api/v1/logins/:id': loginAdminSchema,
} as const;
