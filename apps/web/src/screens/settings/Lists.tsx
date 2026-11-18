import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { CrudPage } from '../../patterns/crud-page.js';
import { PatternFrame } from '../../patterns/frame.js';
import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileWarning,
  Hourglass,
  List,
  Lock,
  Wrench,
  Zap,
  type IconComponent,
} from '../../ui/icon.js';
import { LIST_PAGES, glossarySpec, listMenu, type ListsPage } from './lists-specs.js';

const ICON: Record<ListsPage, IconComponent> = {
  wait_reason: Hourglass,
  work_type: Wrench,
  quick_problem: CircleHelp,
  breakdown_category: Zap,
  lockout_step: Lock,
  failure_code: FileWarning,
};

/** The phone's list of lists: every row comes from `LIST_PAGES`, so a new list needs no screen code. */
function ListsHub() {
  const { t } = useTranslation();
  const rows = listMenu(LIST_PAGES);
  return (
    <PatternFrame title={t('lists.title')}>
      <p className="text-footnote text-neutral-600">{t('lists.intro')}</p>
      <ul className="rounded-2xl bg-surface px-4 shadow-card">
        {rows.map((row, index) => {
          const Icon = ICON[LIST_PAGES[index]!.page] ?? List;
          return (
            <li key={row.to} className="border-t border-neutral-200 first:border-t-0">
              <Link to={row.to} className="flex min-h-16 items-center gap-3 py-2">
                <Icon aria-hidden size={22} />
                <span className="flex-1">
                  <span className="block text-body font-semibold">{t(row.titleKey)}</span>
                  <span className="block text-footnote text-neutral-600">{t(row.subKey)}</span>
                </span>
                <ChevronRight aria-hidden size={20} />
              </Link>
            </li>
          );
        })}
      </ul>
    </PatternFrame>
  );
}

/** One list, edited by the generated settings screen for its spec (D5). */
export function ListsScreen() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const chosen = LIST_PAGES.find((page) => page.page === params.get('list'));
  if (!chosen) return <ListsHub />;
  return (
    <div className="flex flex-col gap-3">
      <Link
        to="/settings/lists"
        className="-ml-2 flex min-h-target-min w-fit items-center gap-1 rounded-xl px-2 text-body font-semibold"
      >
        <ChevronLeft aria-hidden size={20} />
        {t('lists.all')}
      </Link>
      <CrudPage key={chosen.page} spec={chosen.spec} />
    </div>
  );
}

/** The glossary: one generated screen over `/settings/glossary`. */
export function GlossaryScreen() {
  return <CrudPage spec={glossarySpec} />;
}
