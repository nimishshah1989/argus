import { useTranslation } from 'react-i18next';
import { MachineCard, QuickChip } from '../../ui/floor-pieces.js';
import { Checkbox, Textarea } from '../../ui/input.js';
import { Inline, Stack } from '../../ui/layout.js';
import { StatusPill } from '../../ui/status/status-pill.js';
import { Text } from '../../ui/text.js';
import type { ReportState } from './report-state.js';
import type { FloorData } from './use-floor.js';

/** The card above Step 3: the machine and the situation picked (A1-5). */
export function ProblemLead({ report }: { report: ReportState }) {
  return (
    <MachineCard
      code={report.machine?.code ?? ''}
      // eslint-disable-next-line i18next/no-literal-string -- prop value, not copy
      status={<StatusPill group="ticket" id={report.kind} />}
    />
  );
}

/** Who sends it: maintenance may start work now (A2-4); everyone else reads who is reporting. */
export function WhoIsReporting(p: {
  data: FloorData;
  startNow: boolean;
  onStartNow: (on: boolean) => void;
}) {
  const { t } = useTranslation();
  if (p.data.maintenance)
    return (
      <Checkbox
        label={t('reportFloor.startNow')}
        checked={p.startNow}
        onChange={(e) => p.onStartNow(e.target.checked)}
      />
    );
  return (
    <Text size="footnote" tone="secondary">
      {t('reportFloor.reportingAs', { who: p.data.who })}
    </Text>
  );
}

/** Step 3 of 3: what is wrong, the quick problems, who is reporting. An upgrade sends no new text. */
export function ProblemStep({ data, report }: { data: FloorData; report: ReportState }) {
  const { t } = useTranslation();
  if (report.upgrade) return <Text>{report.supportTicket?.problem}</Text>;
  const quick = (data.config.lists.quick_problem ?? []).filter((item) => item.active);
  return (
    <Stack gap={3}>
      <Textarea
        id="floor-problem"
        aria-label={t('floor.problem')}
        value={report.problem}
        placeholder={t('reportFloor.problemPlaceholder')}
        onChange={(e) => report.setProblem(e.target.value)}
      />
      <Inline gap={2}>
        {quick.map((item) => (
          <QuickChip
            key={item.id}
            label={item.label}
            pressed={report.problem === item.label}
            onClick={() => report.setProblem(item.label)}
          />
        ))}
      </Inline>
      <WhoIsReporting data={data} startNow={report.startNow} onStartNow={report.setStartNow} />
    </Stack>
  );
}
