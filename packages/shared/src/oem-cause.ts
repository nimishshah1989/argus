import { z } from 'zod';
import { calendarDay } from './plant-settings.js';

/**
 * Who a breakdown on a young machine is put down to (ADR 0051): the maker, commissioning, our side, or not decided.
 * Only a person decides it; there is no keyword guess. A breakdown with no saved cause is `undecided`. The cause is
 * one append-only `ticket_event` of type `oem_cause` on the breakdown's ticket; the latest event wins, and saving
 * `undecided` puts a breakdown back to not decided.
 */
export const OEM_CAUSES = ['oem', 'install', 'ours', 'undecided'] as const;
export type OemCause = (typeof OEM_CAUSES)[number];

/** The words the platform printed for each cause; the engine prints these, the screen translates them. */
export const OEM_CAUSE_LABELS: Record<OemCause, string> = {
  oem: 'OEM / build defect',
  install: 'Installation / commissioning',
  ours: 'Our side',
  undecided: 'Not decided',
};

/** What a save may send: the cause alone. Who decided and when are the server's. */
export const oemCauseWriteSchema = z.object({ cause: z.enum(OEM_CAUSES) }).strict();
export type OemCauseWrite = z.infer<typeof oemCauseWriteSchema>;

/** The stored `oem_cause` event payload: the cause, the deciding person's id and the plant date. */
export const oemCausePayloadSchema = z
  .object({
    cause: z.enum(OEM_CAUSES),
    decidedBy: z.string().uuid(),
    decidedDate: calendarDay,
  })
  .strict();
export type OemCausePayload = z.infer<typeof oemCausePayloadSchema>;
