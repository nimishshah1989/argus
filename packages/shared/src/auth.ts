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
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;

export const userSchema = z
  .object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
    title: z.string().nullable(),
    role: z.string(),
    shared: z.boolean(),
    actingPersonId: z.string(),
  })
  .strict();
export type User = z.infer<typeof userSchema>;

export const loginReplySchema = z.object({ token: z.string(), user: userSchema }).strict();
export const meReplySchema = z.object({ user: userSchema }).strict();
export const brandReplySchema = z.object({ company: z.string(), logo: z.null() }).strict();
