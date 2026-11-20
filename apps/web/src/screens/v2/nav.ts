import { useTranslation } from 'react-i18next';
import type { IconName } from '../../ui/v2/icons.js';
import type { NavItem } from '../../ui/v2/shell.js';
import { SECTIONS, type SectionId } from '../analytics/shell/shell-data.js';

/** Each section's icon; the sections, their names and their first pages are the product's own (the analytics shell). */
const ICON: Record<SectionId, IconName> = {
  today: 'today',
  machines: 'machines',
  problems: 'problems',
  reliability: 'reliability',
  people: 'people',
  reports: 'reports',
  guide: 'guide',
};

/** The rail for a v2 screen, with `current` marked as the page you are on. */
export function useNav(current: SectionId): NavItem[] {
  const { t } = useTranslation();
  return SECTIONS.map((s) => ({
    id: s.id,
    label: t(s.label),
    icon: ICON[s.id],
    href: s.tabs[0]?.to ?? '/analytics',
    current: s.id === current,
  }));
}
