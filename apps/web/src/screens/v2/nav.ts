import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { mayOpenDesk } from '../../roles.js';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { IconName } from '../../ui/v2/icons.js';
import type { PaletteEntry } from '../../ui/v2/palette-match.js';
import type { NavItem } from '../../ui/v2/shell.js';
import {
  searchEntries,
  sectionsFor,
  type SearchEntry,
  type SectionId,
} from '../analytics/shell/shell-data.js';

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

/**
 * The rail for a v2 screen, with `current` marked as the page you are on. A known `role` gets the sections it may open
 * (as v1's menu does), then the way out to the desk if it may work there (as the account menu does); none gets all of them.
 */
export function navItems(
  current: SectionId,
  role: string | undefined,
  t: (key: MessageKey) => string,
): NavItem[] {
  const sections = sectionsFor(role).map((s) => ({
    id: s.id,
    label: t(s.label),
    icon: ICON[s.id],
    href: s.tabs[0]?.to ?? '/analytics',
    current: s.id === current,
  }));
  const desk: NavItem = {
    id: 'desk',
    label: t('nav.desk'),
    icon: 'list',
    href: '/desk',
    end: true,
  };
  return role === undefined || mayOpenDesk(role) ? [...sections, desk] : sections;
}

export function useNav(current: SectionId, role?: string): NavItem[] {
  const { t } = useTranslation();
  return navItems(current, role, (key) => t(key));
}

/**
 * What the search lists: each entry named in the reader's language, with the section it sits in as its hint, and
 * the section's name among the words a query is held against (so "problems mttr" finds the MTTR screen).
 */
export function paletteEntries(
  entries: readonly SearchEntry[],
  t: (key: MessageKey, values?: Record<string, string>) => string,
): PaletteEntry[] {
  return entries.map((entry) => {
    const text = t(entry.name);
    const parent = entry.section ? t(entry.section) : '';
    return {
      to: entry.to,
      text,
      hint: entry.section
        ? t('ashell.search.screen', { section: parent })
        : t('ashell.search.section'),
      match: `${text} ${parent}`,
    };
  });
}

/** The pages a login may search: its own sections, their tabs and the screens inside (money only where the engine gives it). */
export function usePaletteEntries(role?: string): PaletteEntry[] {
  const { t } = useTranslation();
  return useMemo(
    () => paletteEntries(searchEntries(sectionsFor(role)), (key, values) => t(key, { ...values })),
    [role, t],
  );
}
