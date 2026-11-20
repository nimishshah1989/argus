import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { MessageKey } from '@uptimo/shared/i18n';
import { useTranslation } from 'react-i18next';
import { getMe } from '../../api.js';
import { Segmented } from '../../ui/v2/segmented.js';
import { sectionsFor, type SectionId } from '../analytics/shell/shell-data.js';

/**
 * One section's screens as a row above the page, as the v1 shell's tabs were: each is its own route. `current` is the
 * route of the screen on show, and the tabs are the ones this login's role may open.
 */
export function SectionTabs({ section, current }: { section: SectionId; current: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user.role;
  const found = sectionsFor(role).find((s) => s.id === section);
  return (
    <Segmented
      label={t('ashell.tabs', {
        section: t(found?.label ?? ('ashell.section.today' as MessageKey)),
      })}
      options={(found?.tabs ?? []).map((tab) => ({ key: tab.to, label: t(tab.label) }))}
      value={current}
      onChange={(to) => navigate(to)}
    />
  );
}
