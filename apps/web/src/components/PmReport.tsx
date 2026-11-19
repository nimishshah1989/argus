import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { PmReport } from '../api.js';
import { FactList, SectionTitle, type FactRow } from '../ui/detail-kit.js';
import { Stack } from '../ui/layout.js';
import { PM_MEASUREMENT_LABELS } from '@uptimo/shared/pm';

/** The machine meter's key inside `readings` (R6/R8); every other key is a `<point>.<metric>` reading item. */
const METER_KEY = 'meter';

/** A reading's name: the plan's measurement label for its metric, else the stored key. */
function readingLabel(t: TFunction, key: string): string {
  if (key === METER_KEY) return t('pm.report.meter');
  const metric = key.split('.')[1] ?? key;
  return PM_MEASUREMENT_LABELS[metric] ?? key;
}

/**
 * The closed PM job's report (ticket 49c): how many points were ticked, which were not done, the readings the
 * technician took and the comment. `doneBy` is the acting person's id (46b's shape), printed as their name.
 */
export function PmReportCard({
  report,
  names,
}: {
  report: PmReport;
  names: Record<string, string>;
}) {
  const { t } = useTranslation();
  const done = Math.max(0, report.total - report.undone.length);
  const person = report.doneBy ? names[report.doneBy] : undefined;
  const rows: FactRow[] = [
    { label: t('pm.close.checklist'), value: t('pm.report.points', { done, total: report.total }) },
    ...(report.undone.length
      ? [{ label: t('pm.report.undone'), value: report.undone.join(', ') }]
      : []),
    ...Object.entries(report.readings).map(([key, value]) => ({
      label: readingLabel(t, key),
      value: String(value),
    })),
    ...(report.comments ? [{ label: t('pm.report.comment'), value: report.comments }] : []),
    ...(person ? [{ label: t('pm.report.doneBy'), value: person }] : []),
  ];
  return (
    <Stack gap={2}>
      <SectionTitle>{t('pm.report.title')}</SectionTitle>
      <FactList rows={rows} />
    </Stack>
  );
}
