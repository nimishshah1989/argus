import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { SegmentedBar } from '../../ui/segmented-bar.js';
import { KeyPage } from './KeyPage.js';
import type { AnalyticsGroup } from './groups.js';
import type { PageTable } from './page-content.js';
import { DataTable } from './parts.js';

type Figure = FiguresReply['figures'][number];

/** The two forms of the Specialization card; the ids are not copy, so the catalogue test does not see them. */
const CATEGORY = 'category';
const CODE = 'code';
type View = typeof CATEGORY | typeof CODE;

/**
 * A4's Specialization card (41e-1): the key's category matrix behind a category/code toggle, as the platform has
 * it. The engine's figures reply carries only the category form and no maintenance-code matrix, so the code form
 * is the honest "Not computed yet" rather than a fabricated table or a dead pill. The whole-page key equality
 * (41a) is what makes that the only truthful reading until an engine packet ships `codesUsed`/`codeMatrix`.
 */
function SpecializationCard({ table }: { table: PageTable }) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>(CATEGORY);
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-body font-semibold">{table.title}</h3>
      <SegmentedBar
        label={t('analytics.specialization.toggle')}
        items={[
          { id: CATEGORY, label: t('analytics.specialization.category') },
          { id: CODE, label: t('analytics.specialization.code') },
        ]}
        selected={view}
        onSelect={(id) => setView(id === CODE ? CODE : CATEGORY)}
      />
      {view === CATEGORY ? (
        <DataTable header={table.header} rows={table.rows} />
      ) : (
        <div className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="text-body font-medium text-neutral-600">{t('analytics.notComputed')}</p>
        </div>
      )}
    </section>
  );
}

/**
 * A4 manpower (41e-1): the key page rendered through the existing KeyPage seam, so the three KPIs, the five
 * tables, the chart and the drill all come from the engine. Only the Specialization card is the screen's own,
 * because it owns the platform's category/code toggle; the mapper marks the Manpower table and the two month
 * matrices sortable, and PageFigure draws them in the face's one sortable table.
 */
export function ManpowerPage({
  figure,
  group,
}: {
  figure: Figure | undefined;
  group: AnalyticsGroup;
}) {
  return (
    <KeyPage
      figure={figure}
      group={group}
      renderTable={(table) =>
        table.title === 'Specialization' ? <SpecializationCard table={table} /> : undefined
      }
    />
  );
}
