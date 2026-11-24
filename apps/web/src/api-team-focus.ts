import {
  focusNotesReplySchema,
  type FocusNoteBody,
  type FocusNotesReply,
} from '@uptimo/shared/team-focus-notes';
import { http } from './data/index.js';

/** `GET /analytics/team-focus/notes?period=` (TF-1, ADR 0018): the month's saved notes, parsed at this boundary. */
export const focusNotesQuery = (period: string) => ({
  queryKey: ['team-focus-notes', period],
  queryFn: async (): Promise<FocusNotesReply> =>
    focusNotesReplySchema.parse(
      await http('/api/v1/analytics/team-focus/notes?period=' + encodeURIComponent(period)),
    ),
});

/** `PUT /analytics/team-focus/notes`: one action's note; the month's fresh notes answer, parsed. */
export const saveFocusNote = async (body: FocusNoteBody): Promise<FocusNotesReply> =>
  focusNotesReplySchema.parse(
    await http('/api/v1/analytics/team-focus/notes', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  );
