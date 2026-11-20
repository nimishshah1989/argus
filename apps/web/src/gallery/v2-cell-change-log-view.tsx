/* eslint-disable i18next/no-literal-string -- screen keys and catalogue keys, not copy */
import { useState } from 'react';
import { cellLogModel } from '../screens/v2/cell-change-log/adapter.js';
import { CellLogView } from '../screens/v2/cell-change-log/View.js';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { catalogue } from '../screens/v2/figures/live.js';
import type { Translate } from '../screens/v2/figures/read.js';
import { MachinesScreen, type Viewer } from './v2-machines-screen.js';
import { galleryCode, machinesReply } from './v2-machines-reply.js';

/**
 * The v2 cell change log as a screen will run it, with this view standing in for the server on a corrected date: the
 * day is kept here and the refetched model shows it. `&role=op` hides the correction and `head` shows it.
 */
export default function V2CellChangeLogView() {
  const [days, setDays] = useState<Readonly<Record<string, string>>>({});
  const build = (reply: FiguresReply, t: Translate, viewer: Viewer) =>
    cellLogModel(withDays(reply, days), t, {
      codeOf: galleryCode,
      role: viewer.role,
      today: reply.asOf,
    });
  return (
    <MachinesScreen screen="cell-change-log" title="v2m.title.log" build={build}>
      {(model, shell, viewer) => (
        <CellLogView
          model={
            Object.keys(days).length > 0
              ? (build(machinesReply(), catalogue, viewer) ?? model)
              : model
          }
          {...shell}
          onCorrect={(move, day) => {
            setDays((was) => ({ ...was, [move.id]: day }));
            return Promise.resolve();
          }}
        />
      )}
    </MachinesScreen>
  );
}

type Moves = { moves: { id: string; date: string }[] };

/** The reply with the days the reader corrected. */
function withDays(
  reply: Parameters<typeof cellLogModel>[0],
  days: Readonly<Record<string, string>>,
) {
  return {
    ...reply,
    figures: reply.figures.map((figure) =>
      figure.key === 'cell-change-log'
        ? {
            ...figure,
            value: {
              moves: (figure.value as Moves).moves.map((move) => ({
                ...move,
                date: days[move.id] ?? move.date,
              })),
            },
          }
        : figure,
    ),
  };
}
