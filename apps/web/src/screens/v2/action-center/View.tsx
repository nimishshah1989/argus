/* eslint-disable i18next/no-literal-string -- typed keys and entity kinds only; every visible word comes from the model */
import { useContext } from 'react';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { EntityOpenContext, type EntityRef } from '../../../ui/v2/entity-chip.js';
import { KpiCard } from '../../../ui/v2/kpi-card.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell, type LocalEntity } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import { NudgeDetail } from './NudgeDetail.js';
import { NudgeTable } from './Nudges.js';
import { RiskTable } from './Risk.js';
import type { ActionCenterActions, ActionCenterModel } from './model.js';

/** A nudge opens in the drawer under `?drawer=decision:<id>`; one the board no longer holds is nothing, so the shell says not found. */
function localNudge(
  model: ActionCenterModel,
  ref: EntityRef,
  acts: ActionCenterActions,
): LocalEntity | null {
  if (ref.kind !== 'decision') return null;
  const row = model.nudges.find((n) => n.id === ref.id);
  if (!row) return null;
  return { label: row.titleText, content: <NudgeDetail row={row} model={model} acts={acts} /> };
}

/** The page under the header: the answer, the four priority counts, the nudges, the machines at risk. */
function Body({ model, acts }: { model: ActionCenterModel; acts: ActionCenterActions }) {
  const open = useContext(EntityOpenContext);
  const { current } = useEntityParam();
  const { words } = model;
  return (
    <>
      <Verdict verdict={model.verdict} whyLabel={words.why} />
      <Row cols={4}>
        {model.kpis.map((k) => (
          <KpiCard key={k.id} kpi={k} />
        ))}
      </Row>
      {acts.failed && current?.kind !== 'decision' ? (
        <p role="alert" className="v2-sub v2-seg-loss">
          {words.saveFailed}
        </p>
      ) : null}
      <NudgeTable
        model={model}
        selected={current?.kind === 'decision' ? current.id : undefined}
        onOpen={(row) => open({ kind: 'decision', id: row.id })}
      />
      <RiskTable model={model} />
      <SourceLine text={model.source} />
    </>
  );
}

/**
 * The Action Center: what needs a person now, the four priority counts, every nudge the engine raised with its status,
 * and the machines that keep coming up. A nudge opens in the drawer, which lives in the URL, and is acknowledged,
 * snoozed, resolved or reopened there; a machine, cell or person is a chip that opens its own drawer.
 */
export function ActionCenterView({
  model,
  nav,
  title,
  ...acts
}: { model: ActionCenterModel; nav: NavItem[]; title: string } & ActionCenterActions) {
  return (
    <EntityShell nav={nav} title={title} local={(ref) => localNudge(model, ref, acts)}>
      <Body model={model} acts={acts} />
    </EntityShell>
  );
}
