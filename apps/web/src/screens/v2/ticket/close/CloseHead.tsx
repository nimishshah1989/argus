import { useTranslation } from 'react-i18next';

/** A close screen's header inside the page: Back, then the step's title (v1's full-screen top bar, on the kit). */
export function CloseHead({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="v2-close-head">
      <button type="button" className="v2-btn v2-btn-ghost v2-btn-small" onClick={onBack}>
        {t('common.back')}
      </button>
      <h1 className="v2-h2">{title}</h1>
    </div>
  );
}
