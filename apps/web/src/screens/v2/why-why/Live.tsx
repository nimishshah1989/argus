import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getMe } from '../../../api.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import type { WhyWhyActions, WhyWhyModel } from './model.js';
import { mayWrite, shownName, useWhyWhyRecord, type Viewer } from './record.js';
import { WhyWhyView } from './View.js';

/**
 * Why-Why on the live figures: the page, and for the signed-in person the writes v1 had (start or open a row's own
 * Why-Why, save it, download its PDF). Only the analytics roles may save; the server decides again on every write.
 */
export function WhyWhyLive(props: { model: WhyWhyModel; nav: NavItem[]; title: string }) {
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const user = me.data?.user;
  // An open form belongs to the login and the person acting: another one starts with none.
  return <Writer key={`${user?.id}:${user?.actingPersonId}`} {...props} user={user} />;
}

function Writer({
  model,
  nav,
  title,
  user,
}: {
  model: WhyWhyModel;
  nav: NavItem[];
  title: string;
  user: Viewer | undefined;
}) {
  const { t } = useTranslation();
  const record = useWhyWhyRecord();
  const choice = record.choice;
  const actions: WhyWhyActions = {
    write: mayWrite(user),
    author: t('analytics.whyWhy.author', { name: shownName(user) }),
    failure: record.failure === null ? null : t(record.failure),
    open:
      choice === null
        ? null
        : {
            rowId: choice.rowId,
            machine: choice.machine,
            date: choice.date,
            completed: choice.completed,
            record:
              choice.record === null
                ? null
                : { whys: choice.record.whys, conclusion: choice.record.conclusion },
          },
    saving: record.save.isPending,
    saved: record.save.isSuccess,
    onStart: (row) => void record.open(row),
    onSave: (body) => {
      if (choice !== null) record.save.mutate({ ticketId: choice.ticketId, body });
    },
    onPdf: () => void record.pdf(),
    onCancel: record.close,
  };
  // Until the login is known the page offers nothing: a refusal is not said to someone not yet identified.
  return (
    <WhyWhyView
      model={model}
      nav={nav}
      title={title}
      actions={user === undefined ? undefined : actions}
    />
  );
}
