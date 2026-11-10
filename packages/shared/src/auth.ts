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
