import type { Segment } from '../../api.js';

interface Props {
  segments: Segment[];
  value: string;
  onChange: (id: string) => void;
}

export function SegmentFilter({ segments, value, onChange }: Props) {
  if (segments.length === 0) return null;
  return (
    <div role="group" aria-label="Filter by segment" className="mt-4 flex flex-wrap gap-2">
      {[{ id: 'all', name: 'All' }, ...segments].map((segment) => {
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
