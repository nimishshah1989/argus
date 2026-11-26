import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listDrafts, removeDraft, type DraftEntry } from '../../offline/outbox.js';
import { Button } from './button.js';

const POLL_MS = 3_000;

/**
 * v1's `components/Drafts` on the v2 kit ("Needs attention"): the offline outbox's actions the server refused on
 * replay (a 409), each with why and a Dismiss. Never silently dropped; polled so a replay that fails shows up.
 * Any face can draw it (the floor above its page, the desk likewise).
 */
export function DraftsList() {
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

  const actionLabel = (action: DraftEntry['action']): string =>
    action === 'close' ? t('drafts.action.close') : t('drafts.action.report');

  if (drafts.length === 0) return null;

  return (
    <section data-testid="drafts" className="v2-card v2-floor-note" data-tone="risk">
      <h2 className="v2-h3">{t('drafts.title')}</h2>
      <ul className="v2-floor-drafts">
        {drafts.map((draft) => (
          <li key={draft.id}>
            <p className="v2-h3">{draft.ref}</p>
            <p className="v2-floor-note-text">
              {draft.reasonKey
                ? t(draft.reasonKey)
                : t('drafts.couldNotApply', {
                    action: actionLabel(draft.action),
                    reason: draft.reason,
                  })}
            </p>
            <Button onClick={() => void dismiss(draft.id)}>{t('drafts.dismiss')}</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
