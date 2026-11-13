import { z } from 'zod';

export const pushKeyReplySchema = z.object({ publicKey: z.string() }).strict();
export const pushSentReplySchema = z.object({ sent: z.number() }).strict();
