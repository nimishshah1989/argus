import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WizardPage } from '../../patterns/wizard-page.js';
import { FloorShell, FloorWaiting } from './floor-shell.js';
import { MachineStep } from './machine-step.js';
import { ProblemLead, ProblemStep } from './problem-step.js';
import { useReport } from './report-state.js';
import { Sent } from './sent.js';
import { SituationLead, SituationStep } from './situation-step.js';
import { TicketSheet } from './ticket-sheet.js';
import { FLOOR, useFloorData, type FloorData } from './use-floor.js';

/** Machine, situation, problem, Send: v3's four taps (decision 1). `?m=VC-17` opens Step 2. */
function ReportFlow(p: { data: FloorData; deepLink: string | null; onAnother: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = p;
  const report = useReport(data, p.deepLink);
  const { machine, group } = report;
  const steps = [
    {
      title: group ? `${group.code} ${group.name}` : t('floor.whichMachine'),
      back: group ? t('reportFloor.groups') : undefined,
      onBack: group ? () => report.setGroup(null) : undefined,
      body: (next: () => void) => (
        <MachineStep
          data={data}
          query={report.query}
          onQuery={report.setQuery}
          group={group}
          onGroup={(g) => {
            report.setGroup(g);
            report.setQuery('');
          }}
          onPick={(m) => report.pick(m, next)}
          onOther={() => navigate(FLOOR.other)}
        />
      ),
    },
    {
      title: t(report.supportTicket ? 'reportFloor.situationNow' : 'reportFloor.situation'),
      back: t('reportFloor.machine'),
      lead: machine ? <SituationLead data={data} machine={machine} report={report} /> : null,
      body: (next: () => void) => <SituationStep report={report} next={next} />,
    },
    {
      title: t('floor.problem'),
      back: t('reportFloor.type'),
      lead: <ProblemLead report={report} />,
      body: <ProblemStep data={data} report={report} />,
      action: t(report.kind === 'stopped' ? 'reportFloor.sendStopped' : 'reportFloor.sendSupport'),
      ready: report.upgrade || report.problem.trim().length > 0,
    },
  ];
  return (
    <>
      <WizardPage
        title={t('floor.title')}
        quietOnline
        steps={steps}
        start={machine ? 1 : 0}
        offlineAllowed={false}
        onFinish={report.send}
        result={
          report.sent ? <Sent data={data} ticket={report.sent} onAnother={p.onAnother} /> : null
        }
      />
      <TicketSheet data={data} ticket={report.sheet} onClose={() => report.setSheet(null)} />
    </>
  );
}

/** The floor's report screen (ticket 15). "Report another" starts a fresh flow. */
export function Report() {
  const [params] = useSearchParams();
  const [round, setRound] = useState(0);
  const load = useFloorData();
  const data = load.data;
  return (
    <FloorShell maintenance={data?.maintenance}>
      {data ? (
        <ReportFlow
          key={round}
          data={data}
          deepLink={round === 0 ? params.get(FLOOR.machine) : null}
          onAnother={() => setRound((n) => n + 1)}
        />
      ) : (
        <FloorWaiting load={load} />
      )}
    </FloorShell>
  );
}
