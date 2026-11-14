import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listDrafts, removeDraft, type DraftEntry } from '../offline/outbox.js';

const POLL_MS = 3_000;

/** The 409 close drafts the outbox could not replay; dismissable, never silently dropped. */
export function Drafts() {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);

  useEffect(() => {
    let active = true;
    function refresh() {
      listDrafts()
        .then((items) => {
          if (active) setDrafts(items);
        })
        .catch(() => undefined);
    }
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function dismiss(id: string) {
    await removeDraft(id);
    setDrafts((items) => items.filter((draft) => draft.id !== id));
  }

  function actionLabel(action: DraftEntry['action']): string {
    return action === 'close' ? t('drafts.action.close') : t('drafts.action.report');
  }

  if (drafts.length === 0) return null;

  return (
    <section data-testid="drafts" className="mt-4 rounded-2xl bg-surface p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">{t('drafts.title')}</h2>
      <ul className="mt-3 space-y-3">
        {drafts.map((draft) => (
          <li key={draft.id} className="rounded-xl border border-neutral-200 p-3">
            <p className="text-base font-semibold tracking-tight">{draft.ref}</p>
            <p className="mt-1 text-sm text-neutral-600">
              {t('drafts.couldNotApply', {
                action: actionLabel(draft.action),
                reason: draft.reason,
              })}
            </p>
            <button
              type="button"
              onClick={() => void dismiss(draft.id)}
              className="mt-3 min-h-13 rounded-xl border border-control bg-surface px-4 text-base font-semibold text-neutral-900 "
            >
              {t('drafts.dismiss')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
