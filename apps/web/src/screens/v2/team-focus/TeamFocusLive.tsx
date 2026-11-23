import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getMe, useAnalyticsFigures } from '../../../api.js';
import { saveFocusNote } from '../../../api-team-focus.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { shownName } from '../why-why/record.js';
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
  const { t } = useTranslation();
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
  // The one-click owner changes have no form to say Could not save, so the page does.
  const [failed, setFailed] = useState(false);
  const quick = (id: string, owner: string) => {
    setFailed(false);
    onSave(id, { owner }).catch(() => setFailed(true));
  };
  const name = shownName(user);
  return (
    <>
      {failed ? (
        <p role="alert" className="v2-sub v2-seg-loss">
          {t('v2tf.edit.failed')}
        </p>
      ) : null}
      <TeamFocusView
        {...props}
        canSave={period !== null}
        onSave={onSave}
        // Until the signed-in person is known "I’ll take it" saves nothing, never an empty owner.
        onAssign={name === '' ? undefined : (id) => quick(id, name)}
        onUnassign={(id) => quick(id, '')}
      />
    </>
  );
}
