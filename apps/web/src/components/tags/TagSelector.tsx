import { useTranslation } from 'react-i18next';
import type { TagDefinition } from '../../../../../packages/shared/src/tags.js';
import { groupByCategory, isApplied } from './logic.js';

interface Props {
  available: TagDefinition[];
  applied: ReadonlySet<string>;
  pending: boolean;
  onToggle: (tagId: string) => void;
}

export function TagSelector({ available, applied, pending, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <div className="mt-2 flex flex-col gap-3" data-testid="tag-selector">
      {groupByCategory(available).map((group) => (
        <div key={group.category}>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {t(`tags.category.${group.category}`)}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {group.tags.map((tag) => {
              const on = isApplied(applied, tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={on}
                  disabled={pending}
                  onClick={() => onToggle(tag.id)}
                  className={[
                    'min-h-13 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    on
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100',
                    pending ? 'opacity-40' : '',
                  ].join(' ')}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
