import { useTranslation } from 'react-i18next';
import type { BoardCounts } from './data.js';

export function Counts({ counts, large }: { counts: BoardCounts; large: boolean }) {
  const { t } = useTranslation();
  const items = [
    { key: 'total', label: t('board.counts.open') },
    { key: 'stopped', label: t('board.counts.stopped') },
    { key: 'waiting', label: t('board.counts.waiting') },
    { key: 'support', label: t('board.counts.support') },
    { key: 'workRequests', label: t('board.counts.workRequests') },
  ] as const;
  return (
    <section aria-label={t('board.counts.aria')} className="mt-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {items.map((item) => (
          <div key={item.key} className="rounded-xl bg-white p-3 shadow-sm">
            <dt className={`text-neutral-500 ${large ? 'text-base' : 'text-xs'}`}>{item.label}</dt>
            <dd
              data-testid={`count-${item.key}`}
              className={`mt-0.5 font-semibold tracking-tight ${large ? 'text-4xl' : 'text-2xl'}`}
            >
              {counts[item.key]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
