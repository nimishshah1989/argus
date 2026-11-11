import { describe, expect, it } from 'vitest';
import type { TagCategory, TagDefinition } from '../../../../../packages/shared/src/tags.js';
import { groupByCategory, mergeAvailableTags } from './logic.js';

function tag(id: string, category: TagCategory, sortOrder: number): TagDefinition {
  return { id, code: id, label: id, category, active: true, sortOrder };
}

describe('tag presentation', () => {
  it('groups configured categories and sorts by tenant order then code', () => {
    const groups = groupByCategory([
      tag('z', 'work_type', 2),
      tag('a', 'work_type', 1),
      tag('m', 'maint_code', 1),
      tag('e', 'breakdown_category', 1),
    ]);
    expect(groups.map((group) => group.category)).toEqual([
      'breakdown_category',
      'maint_code',
      'work_type',
    ]);
    expect(groups[2]?.tags.map((tag) => tag.id)).toEqual(['a', 'z']);
  });

  it('keeps inactive applied definitions editable without duplicating active options', () => {
    const active = tag('active', 'work_type', 1);
    const inactive = { ...tag('inactive', 'work_type', 2), active: false };
    const merged = mergeAvailableTags([active], [inactive, active]);
    expect(merged.map((tag) => tag.id)).toEqual(['active', 'inactive']);
    expect(merged[1]?.active).toBe(false);
  });
});
