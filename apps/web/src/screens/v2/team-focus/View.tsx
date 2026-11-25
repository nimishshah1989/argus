import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/v2/button.js';
import { DrillAction } from '../../../ui/v2/drill-action.js';
import { DecisionList } from '../../../ui/v2/domain/decision-list.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { EntityOpenContext, type EntityKind } from '../../../ui/v2/entity-chip.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { DownloadExcel } from '../../../ui/v2/download-excel.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Points } from '../../../ui/v2/points.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Takeaway, type TakeawayData } from '../../../ui/v2/takeaway.js';
import { TileSet } from '../../../ui/v2/tile-set.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import { numberIn } from '../figures/read.js';
import { localAction, type Acts } from './local.js';
import type { TeamFocusActions, TeamFocusModel } from './model.js';
import { teamFocusSheets } from './sweep.js';
import { ActionTable, PeopleTable } from './tables.js';

const ignore = () => {};

const Kpis = ({ kpis }: { kpis: TeamFocusModel['kpis'] }) => (
  <TileSet items={kpis.map((kpi) => ({ kpi, n: numberIn(kpi.value) ?? Number.NaN }))} />
);

/** A section's takeaway, drawn at its top; nothing when the section has none. */
const Line = ({ data }: { data?: TakeawayData | null }) => (data ? <Takeaway data={data} /> : null);

/** The engine's proposal for whoever is over the line, ending in the one action that takes it. */
function RebalanceCard({ model, act }: { model: TeamFocusModel; act: Acts }) {
  const r = model.rebalance!;
  return (
    <Panel title={r.title}>
      <Points points={r.points} />
      {r.done ? (
        // eslint-disable-next-line i18next/no-literal-string -- a tone and an icon name, not copy
        <KeyPill text={r.doneText} tone="gain" icon="check" />
      ) : (
        <div>
          <Button primary onClick={act.onRebalance}>
            {r.action}
          </Button>
        </div>
      )}
    </Panel>
  );
}

/** "I'll take it" did not save; said in the page body beside the decisions, not above the shell. */
function AssignFailed() {
  const { t } = useTranslation();
  return (
    <p role="alert" className="v2-sub v2-seg-loss">
      {t('v2tf.edit.failed')}
    </p>
  );
}

/** The page under the header, top to bottom; a decision, a person, a machine or a row opens its detail in the drawer. */
function Body({
  model,
  act,
  assignFailed,
}: {
  model: TeamFocusModel;
  act: Acts;
  assignFailed: boolean;
}) {
  const { words } = model;
  const open = useContext(EntityOpenContext);
  const { current } = useEntityParam();
  const opener = (kind: EntityKind) => ({
    selected: current?.kind === kind ? current.id : undefined,
    onOpen: (id: string) => open({ kind, id }),
  });
  const decision = opener('decision');
  const person = opener('person');
  const machine = opener('machine');
  return (
    <>
      <Verdict verdict={model.verdict} whyLabel={words.why} />
      <Kpis kpis={model.kpis} />
      {assignFailed ? <AssignFailed /> : null}
      <Line data={model.takeaways?.start} />
      {model.start.length > 0 ? (
        <DecisionList
          decisions={model.start}
          words={words.decisions}
          {...decision}
          // Absent until the user and the month are known: the rows then hide "I'll take it" (ticket 594).
          onDecide={act.onAssign}
          onUndo={act.onUnassign}
        />
      ) : (
        <Panel title={words.decisions.title}>
          <p className="v2-sub">{words.allOwned}</p>
        </Panel>
      )}
      <Line data={model.takeaways?.people} />
      <div>
        <DownloadExcel file="team-focus" sheets={teamFocusSheets(model)} />
      </div>
      {model.rebalance ? (
        <Row wide>
          <PeopleTable people={model.people} words={words.people} {...person} />
          <RebalanceCard model={model} act={act} />
        </Row>
      ) : (
        <PeopleTable people={model.people} words={words.people} {...person} />
      )}
      <Line data={model.takeaways?.actions} />
      <ActionTable actions={model.actions} words={words.actions} {...machine} />
      {model.drill ? (
        <div>
          <DrillAction drill={model.drill} />
        </div>
      ) : null}
      <SourceLine text={model.source} />
    </>
  );
}

/**
 * The decision-first Team Focus: the verdict, four key figures, the actions waiting for an owner, who is carrying
 * what beside what to move, and every action of the month. A decision, a person, a machine or any chip opens its
 * detail in the drawer, which lives in the URL: Back, ✕, Esc or the same item again closes it.
 */
export function TeamFocusView({
  model,
  nav,
  title,
  onAssign,
  onUnassign,
  onRebalance = ignore,
  onSave = ignore,
  canSave = true,
  assignFailed = false,
}: {
  model: TeamFocusModel;
  nav: NavItem[];
  title: string;
  /** False while the plan names no month: the action drawer then offers no form. */
  canSave?: boolean;
  /** The last "I'll take it" did not save; said beside the decisions. */
  assignFailed?: boolean;
} & TeamFocusActions) {
  const act: Acts = { onAssign, onUnassign, onRebalance, onSave };
  return (
    <EntityShell nav={nav} title={title} local={(ref) => localAction(model, ref, act, canSave)}>
      <Body model={model} act={act} assignFailed={assignFailed} />
    </EntityShell>
  );
}
