import { z } from 'zod';

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

export const personCreateSchema = z
  .object({
    name: text(120),
    shortName: optionalText(40).optional(),
    phone: phone.optional(),
    team,
    kind: z.enum(['staff', 'production', 'vendor']).optional(),
    title: optionalText(60).optional(),
    cell: optionalText(60).optional(),
    defaultShift: optionalText(20).optional(),
  })
  .strict();
export type PersonCreate = z.infer<typeof personCreateSchema>;

/** `active: false` switches the person off, `active: true` back on; there is no delete. */
export const personPatchSchema = personCreateSchema
  .partial()
  .extend({ active: z.boolean().optional() })
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
    kind: z.enum(['staff', 'production', 'vendor']),
    title: z.string().nullable(),
    cell: z.string().nullable(),
    defaultShift: z.string().nullable(),
    active: z.boolean(),
    pending: z.boolean(),
  })
  .strict();
export type PersonAdmin = z.infer<typeof personAdminSchema>;
export const personReplySchema = z.object({ person: personAdminSchema }).strict();
export const peopleReplySchema = z.object({ people: z.array(personAdminSchema) }).strict();

const username = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9._-]{2,59}$/,
    'Use 3 to 60 lowercase letters, digits, dots, dashes or underscores',
  );
const temporaryPassword = z.string().min(1).max(200);
const role = z.enum(LOGIN_ROLES);

export const loginCreateSchema = z
  .object({
    username,
    role,
    shared: z.boolean(),
    personId: z.string().uuid().nullable().optional(),
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
  });
export type LoginCreate = z.infer<typeof loginCreateSchema>;

/** `disabled: true` switches a login off; switching on needs a new `temporaryPassword`. */
export const loginPatchSchema = z
  .object({
    role: role.optional(),
    cell: optionalText(60).optional(),
    disabled: z.boolean().optional(),
    temporaryPassword: temporaryPassword.optional(),
  })
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
    disabled: z.boolean(),
  })
  .strict();
export type LoginAdmin = z.infer<typeof loginAdminSchema>;
export const loginOneReplySchema = z.object({ login: loginAdminSchema }).strict();
export const loginsReplySchema = z.object({ logins: z.array(loginAdminSchema) }).strict();

/** Reply schema of each people-and-logins route, spread into `REPLY_SCHEMAS`. */
export const PEOPLE_REPLIES = {
  'GET /api/v1/people': peopleReplySchema,
  'POST /api/v1/people': personReplySchema,
  'PATCH /api/v1/people/:id': personReplySchema,
  'GET /api/v1/logins': loginsReplySchema,
  'POST /api/v1/logins': loginOneReplySchema,
  'PATCH /api/v1/logins/:id': loginOneReplySchema,
} as const;
