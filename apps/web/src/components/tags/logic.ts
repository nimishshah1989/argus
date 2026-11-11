import {
  TAG_CATEGORIES,
  type TagCategory,
  type TagDefinition,
} from '../../../../../packages/shared/src/tags.js';

export interface TagGroup {
  category: TagCategory;
  tags: TagDefinition[];
}

/** Groups in the public category order, then each tenant's configured sort/code order. */
export function groupByCategory(tags: TagDefinition[]): TagGroup[] {
  return TAG_CATEGORIES.map((category) => ({
    category,
    tags: tags
      .filter((tag) => tag.category === category)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)),
  })).filter((group) => group.tags.length > 0);
}

/** Active catalogue plus any applied definition retired from that catalogue. */
export function mergeAvailableTags(
  catalogue: TagDefinition[],
  applied: TagDefinition[],
): TagDefinition[] {
  const merged = [...catalogue];
  const ids = new Set(catalogue.map((tag) => tag.id));
  for (const tag of applied) {
    if (!ids.has(tag.id)) {
      merged.push(tag);
      ids.add(tag.id);
    }
  }
  return merged;
}
