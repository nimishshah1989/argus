import type { TagDefinition } from '../../../../../packages/shared/src/tags.js';

export function TagPill({ tag }: { tag: TagDefinition }) {
  return (
    <span
      className="inline-flex items-center rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700"
      title={tag.category}
    >
      {tag.label}
    </span>
  );
}

export function TagList({ tags }: { tags: TagDefinition[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <TagPill key={tag.id} tag={tag} />
      ))}
    </div>
  );
}
