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

export function isApplied(applied: ReadonlySet<string>, tagId: string): boolean {
  return applied.has(tagId);
}
