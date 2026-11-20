/* eslint-disable i18next/no-literal-string -- typed note kinds only; every visible word comes from the model */
import { useState } from 'react';
import { Button } from '../../../ui/v2/button.js';
import { CorrectDate } from '../../../ui/v2/domain/correct-date.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { EngineTable } from '../../../ui/v2/domain/engine-table.js';
import { KpiCard } from '../../../ui/v2/kpi-card.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { fill } from '../../../i18n/fill.js';
import { EntityShell } from '../entity/EntityShell.js';
import { saveText } from './save-text.js';
import type { CellLogModel } from './model.js';

/** What the screen asks of whoever holds the server: send one corrected day; a rejection says why in words. */
export type CellLogActions = {
  onCorrect?: (move: { id: string; machineId: string }, day: string) => Promise<void>;
};

type Note = { kind: 'saved' | 'exported' | 'exportError'; at: number } | null;

function ExportPanel({ model, onNote }: { model: CellLogModel; onNote: (note: Note) => void }) {
  const { words } = model;
  const download = () => {
    try {
      saveText(model.csv.fileName, model.csv.text);
      onNote({ kind: 'exported', at: Date.now() });
    } catch {
      onNote({ kind: 'exportError', at: Date.now() });
    }
  };
  return (
    <Panel
      title={words.exportTitle}
      sub={words.exportSub}
      aside={<Button onClick={download}>{words.export}</Button>}
    >
      {null}
    </Panel>
  );
}

function Correcting({
  model,
  id,
  onDone,
  onCorrect,
}: {
  model: CellLogModel;
  id: string;
  onDone: (saved: boolean) => void;
  onCorrect: NonNullable<CellLogActions['onCorrect']>;
}) {
  const move = model.moves.find((m) => m.id === id);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!move) return null;
  const save = async (day: string) => {
    setPending(true);
    setError(null);
    try {
      await onCorrect(move, day);
      onDone(true);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : model.words.refused);
      setPending(false);
    }
  };
  return (
    <CorrectDate
      key={id}
      words={model.words.correct}
      sub={fill(model.words.correctSub, { machine: move.code, change: move.change })}
      initial={move.day}
      pending={pending}
      error={error}
      onSave={(day) => void save(day)}
      onCancel={() => onDone(false)}
    />
  );
}

/**
 * The cell change log: every recorded move, newest first, with the machine, the cell and the location it went to.
 * A head or an admin corrects a move's date from its row; the controlled document exports as a CSV with its number.
 */
export function CellLogView({
  model,
  nav,
  title,
  onCorrect,
}: { model: CellLogModel; nav: NavItem[]; title: string } & CellLogActions) {
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const { words } = model;
  const noted =
    note?.kind === 'saved' ? words.saved : note?.kind === 'exported' ? words.exported : null;
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={words.why} />
      <Row cols={2}>
        {model.kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </Row>
      {model.moves.length > 0 ? <ExportPanel model={model} onNote={setNote} /> : null}
      {note?.kind === 'exportError' ? (
        <p role="alert" className="v2-sub v2-seg-loss">
          {words.exportError}
        </p>
      ) : null}
      {noted ? (
        <p role="status" className="v2-sub v2-seg-gain">
          {noted}
        </p>
      ) : null}
      {correcting && onCorrect ? (
        <Correcting
          model={model}
          id={correcting}
          onCorrect={onCorrect}
          onDone={(saved) => {
            setCorrecting(null);
            if (saved) setNote({ kind: 'saved', at: Date.now() });
          }}
        />
      ) : null}
      {model.moves.length === 0 ? (
        <Panel title={model.table.title}>
          <p className="v2-sub">{words.empty}</p>
        </Panel>
      ) : (
        <EngineTable table={model.table} onAction={setCorrecting} />
      )}
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
