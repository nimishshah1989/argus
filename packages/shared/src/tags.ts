import type { ListName } from './config.js';

export const TAG_CATEGORIES = [
  'breakdown_category',
  'maint_code',
  'work_type',
] as const satisfies readonly ListName[];
export type TagCategory = (typeof TAG_CATEGORIES)[number];

export interface TagDefinition {
  id: string;
  code: string;
  label: string;
  labelGu?: string;
  labelHi?: string;
  category: TagCategory;
  active: boolean;
  sortOrder: number;
}

export interface TicketTag {
  tagId: string;
  appliedAt: string;
  appliedBy: string | null;
  appliedByLogin: string | null;
}

export interface TagList {
  applied: TicketTag[];
  tags: TagDefinition[];
}

export function isTagCategory(value: string): value is TagCategory {
  return (TAG_CATEGORIES as readonly string[]).includes(value);
}
