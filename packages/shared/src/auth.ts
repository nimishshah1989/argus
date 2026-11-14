import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1).max(60),
  password: z.string().min(1),
  device: z.string().max(120).optional(),
  actingPersonId: z.string().uuid().optional(),
});
export type LoginBody = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  old: z.string().min(1),
  password: z.string().min(8),
});
/** A shared phone says who is using it now. */
export const actingPersonSchema = z.object({ actingPersonId: z.string().uuid() });

export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;

export const userSchema = z
  .object({
    id: z.string(),
    username: z.string(),
    // On a shared phone whose acting person was switched off, `name` and `actingPersonId` are '' until the app
    // asks who is using it.
    name: z.string(),
    title: z.string().nullable(),
    role: z.string(),
    shared: z.boolean(),
    actingPersonId: z.string(),
    mustChangePassword: z.boolean().optional(),
    // Set only for our own support staff under a customer-approved grant (D29). `id` is then the approving
    // admin's login, so a client that asks "is this me" must also look here.
    supportGrantId: z.string().optional(),
    // Who is acting now; null on a shared phone whose acting person was switched off, until the app asks again.
    actingPerson: z
      .object({ id: z.string(), name: z.string(), title: z.string().nullable() })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();
export type User = z.infer<typeof userSchema>;

export const loginReplySchema = z.object({ token: z.string(), user: userSchema }).strict();
export const meReplySchema = z.object({ user: userSchema }).strict();
/** `logo` is the public path of the company's logo, or null when it has none. */
export const brandReplySchema = z
  .object({ company: z.string(), logo: z.string().nullable() })
  .strict();
