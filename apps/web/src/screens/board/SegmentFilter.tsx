import { useTranslation } from 'react-i18next';
import type { Segment } from '../../api.js';

interface Props {
  segments: Segment[];
  value: string;
  onChange: (id: string) => void;
}

export function SegmentFilter({ segments, value, onChange }: Props) {
  const { t } = useTranslation();
  if (segments.length === 0) return null;
  const items = [{ id: 'all', name: t('board.all') }, ...segments];
  return (
    <div role="group" aria-label={t('board.filter.aria')} className="mt-4 flex flex-wrap gap-2">
      {items.map((segment) => {
        const selected = segment.id === value;
        return (
          <button
            key={segment.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(segment.id)}
            className={`min-h-13 rounded-full px-4 text-sm font-semibold ${
              selected
                ? 'bg-neutral-900 text-white'
                : 'bg-white text-neutral-700 shadow-sm hover:bg-neutral-50'
            }`}
          >
            {segment.name}
          </button>
        );
      })}
    </div>
  );
}
