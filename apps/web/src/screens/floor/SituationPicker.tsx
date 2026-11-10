import { useTranslation } from 'react-i18next';
import type { RaiseKind } from '../../api.js';

export function SituationPicker({
  kind,
  onChange,
}: {
  kind: RaiseKind;
  onChange: (kind: RaiseKind) => void;
}) {
  const { t } = useTranslation();
  const situations: { kind: RaiseKind; label: string }[] = [
    { kind: 'stopped', label: t('floor.stopped') },
    { kind: 'support', label: t('floor.support') },
    { kind: 'general', label: t('floor.workRequest') },
  ];
  return (
    <section>
      <h2 className="text-sm font-medium text-neutral-600">{t('floor.what')}</h2>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {situations.map((situation) => {
          const selected = kind === situation.kind;
          return (
            <button
              key={situation.kind}
              type="button"
              onClick={() => onChange(situation.kind)}
              aria-pressed={selected}
              className={`min-h-13 rounded-xl border px-2 text-base font-medium ${
                selected
                  ? 'border-accent bg-accent text-white'
                  : 'border-neutral-300 bg-white text-neutral-800'
              }`}
            >
              {situation.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
