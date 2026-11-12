import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { putWaitReason, type ListItem } from '../api.js';
import { invalidateSlaData } from './slaQueries.js';

interface Props {
  reasons: ListItem[];
  available: boolean;
  online: boolean;
}

export function SlaWaitReasonSettings({ reasons, available, online }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function change(item: ListItem): Promise<void> {
    if (!online || pending) return;
    setPending(item.code);
    setError(null);
    setSaved(false);
    try {
      await putWaitReason({ ...item, pausesSla: !item.pausesSla });
      await invalidateSlaData(queryClient);
      setSaved(true);
    } catch {
      setError(t('settings.waitSlaSaveFailed'));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">{t('settings.waitSlaTitle')}</h2>
      <p className="mt-1 text-sm text-neutral-600">{t('settings.waitSlaHelp')}</p>
      {!available ? (
        <p className="mt-3 text-neutral-600">{t('settings.slaUnavailable')}</p>
      ) : reasons.length === 0 ? (
        <p className="mt-3 text-neutral-600">{t('settings.waitSlaEmpty')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100">
          {reasons.map((item) => (
            <li key={item.code}>
              <label className="flex min-h-13 items-center gap-3 rounded-lg px-1 text-base text-neutral-800">
                <input
                  type="checkbox"
                  checked={pending === item.code ? !item.pausesSla : item.pausesSla}
                  disabled={!online || pending !== null}
                  onChange={() => void change(item)}
                  className="h-5 w-5 accent-accent"
                />
                {t('settings.waitSlaFor', { label: item.label })}
              </label>
            </li>
          ))}
        </ul>
      )}
      {saved && (
        <p role="status" className="mt-3 text-sm text-green-800">
          {t('settings.waitSlaSaved')}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </section>
  );
}
