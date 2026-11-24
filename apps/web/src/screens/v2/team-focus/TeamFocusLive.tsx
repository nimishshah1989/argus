import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getMe, useAnalyticsFigures } from '../../../api.js';
import { saveFocusNote } from '../../../api-team-focus.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { shownName } from '../why-why/record.js';
import { assignHandlers } from './assign.js';
import { focusPeriod } from './live.js';
import type { NoteChange, TeamFocusModel } from './model.js';
import { TeamFocusView } from './View.js';
import { noteBody } from './writes.js';

/**
 * Team Focus on the live figures: the page, and for the signed-in person the saves (status, owner, note, "I’ll take
 * it"). A save puts the month's fresh notes in the cache and re-reads the figures; the page rebuilds from them.
 */
export function TeamFocusLive(props: { model: TeamFocusModel; nav: NavItem[]; title: string }) {
  const { model } = props;
  const client = useQueryClient();
  const user = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user;
  const figures = useAnalyticsFigures().data;
  const period = figures === undefined ? null : focusPeriod(figures);
  const save = useMutation({
    mutationFn: saveFocusNote,
    onSuccess: async (reply) => {
      client.setQueryData(['team-focus-notes', period], reply);
      await client.invalidateQueries({ queryKey: ['analytics-figures'] });
    },
  });
  // Returns the save's promise so the drawer can say Saved or Could not save.
  const onSave = async (id: string, change: NoteChange) => {
    const body = period === null ? null : noteBody(model, period, id, change);
    if (body !== null) await save.mutateAsync(body);
  };
  // The one-click owner changes have no form to say Could not save, so the page does (beside the decisions).
  const [assignFailed, setAssignFailed] = useState(false);
  const name = shownName(user);
  // Absent until the signed-in person and the month are known, so "I’ll take it" never saves an empty owner.
  const assign = assignHandlers(name === '' ? null : name, period, (id, owner) => {
    setAssignFailed(false);
    return onSave(id, { owner }).catch(() => setAssignFailed(true));
  });
  return (
    <TeamFocusView
      {...props}
      canSave={period !== null}
      onSave={onSave}
      onAssign={assign.onAssign}
      onUnassign={assign.onUnassign}
      assignFailed={assignFailed}
    />
  );
}
