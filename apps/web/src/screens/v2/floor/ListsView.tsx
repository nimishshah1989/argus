/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible word comes from the model */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BottomSheet } from '../../../ui/v2/bottom-sheet.js';
import { Button } from '../../../ui/v2/button.js';
import {
  Actions,
  FieldLabel,
  FloorPanel,
  FloorStates,
  Line,
  MachineCard,
  TextArea,
} from '../../../ui/v2/floor-kit.js';
import { StatusPill } from '../../../ui/v2/status-pill.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import type {
  CancelModel,
  DisputeModel,
  ListPill,
  ListTakeaway,
  MineModel,
  More,
  PmModel,
  SignoffModel,
} from './lists-model.js';

/**
 * Draws the floor lists inside #767's `FloorFrame` (tabs, Account, Drafts). Page order is pinned by
 * `e2e/gallery/floor-order-lists.ts` (`MINE`, `MINE_TECH`, `DISPUTE`, `CANCEL`, `PM`): title `h2`, then per card
 * Cancel, then `h3` "Is it fixed?" with "Yes, it is fixed" / "Not fixed"; no `h1`, no extra button or link.
 * Built from the v2 kit: `ui/v2/floor-kit` (panel, card, states, fields), `StatusPill`, `Button`, `BottomSheet`,
 * and the `Takeaway`.
 */

export type MineActions = {
  more: () => void;
  /** The error / offline notice's Try again; falls back to `more` when absent. */
  retry?: () => void;
  cancel: (ticketId: string) => void;
  yes: (ticketId: string) => void;
  no: (ticketId: string) => void;
};

function Pill({ pill }: { pill: ListPill }) {
  if (pill.group === 'floor') return <StatusPill group="floor" id={pill.id} />;
  if (pill.group === 'handback') return <StatusPill group="handback" id={pill.id} />;
  return <StatusPill group="ticket" id={pill.id} />;
}

/** The takeaway (a `p`) and the yardstick under it: neither is a heading, link or button. */
function Opening({ takeaway }: { takeaway: ListTakeaway | null }) {
  if (!takeaway) return null;
  return (
    <div className="flex flex-col gap-1">
      <Takeaway data={takeaway} />
      <Line quiet>{takeaway.yardstick}</Line>
    </div>
  );
}

function LoadMore({ more, onMore }: { more: More; onMore: () => void }) {
  return more ? (
    <Actions>
      <Button disabled={more.busy} onClick={onMore}>
        {more.label}
      </Button>
    </Actions>
  ) : null;
}

function Signoff(p: { id: string; signoff: SignoffModel; on: Pick<MineActions, 'yes' | 'no'> }) {
  const { signoff } = p;
  if (signoff.kind === 'answered')
    return (
      <>
        {signoff.lines.map((line) => (
          <Line key={line.text} quiet={line.quiet}>
            {line.text}
          </Line>
        ))}
      </>
    );
  return (
    <div className="flex flex-col gap-3">
      <h3 className="v2-h3">{signoff.title}</h3>
      {signoff.body ? <Line>{signoff.body}</Line> : null}
      {signoff.error ? <Line bad>{signoff.error}</Line> : null}
      <Actions pair>
        <Button primary disabled={signoff.busy} onClick={() => p.on.yes(p.id)}>
          {signoff.yes}
        </Button>
        <Button onClick={() => p.on.no(p.id)}>{signoff.no}</Button>
      </Actions>
    </div>
  );
}

function Complaint({ card, on }: { card: MineModel['cards'][number]; on: MineActions }) {
  return (
    <MachineCard code={card.place} status={<Pill pill={card.pill} />}>
      {card.stopped ? <Line bad>{card.kindLine}</Line> : <Line quiet>{card.kindLine}</Line>}
      <Line>{card.problem}</Line>
      <Line quiet>{card.reported}</Line>
      {card.signoff ? <Signoff id={card.id} signoff={card.signoff} on={on} /> : null}
      {card.cancel ? (
        <Actions>
          <Button danger onClick={() => on.cancel(card.id)}>
            {card.cancel}
          </Button>
        </Actions>
      ) : null}
    </MachineCard>
  );
}

/** `/floor/mine`: takeaway, then each card as a list item (`li`) carrying its REF, then Load more. */
export function MineView(p: { model: MineModel; on: MineActions }): ReactNode {
  const { model, on } = p;
  return (
    <FloorPanel title={model.title} quietOnline>
      {model.state === 'ready' ? (
        <div className="flex flex-col gap-3">
          <Opening takeaway={model.takeaway} />
          <ul className="v2-floor-list">
            {model.cards.map((card) => (
              <li key={card.id}>
                <Complaint card={card} on={on} />
              </li>
            ))}
          </ul>
          <LoadMore more={model.more} onMore={on.more} />
        </div>
      ) : (
        <FloorStates state={model.state} empty={model.empty} onRetry={on.retry ?? on.more} />
      )}
    </FloorPanel>
  );
}

/** `/floor/pm`: takeaway and hint, then each job as one link to `/desk/:id`, then Load more. */
export function PmJobsView(p: {
  model: PmModel;
  on: { more: () => void; retry?: () => void };
}): ReactNode {
  const { model, on } = p;
  return (
    <FloorPanel title={model.title} quietOnline>
      {model.state === 'ready' ? (
        <div className="flex flex-col gap-3">
          <Opening takeaway={model.takeaway} />
          <Line quiet>{model.hint}</Line>
          <ul className="v2-floor-list">
            {model.cards.map((card) => (
              <li key={card.id}>
                <Link to={card.href}>
                  <MachineCard
                    code={card.code}
                    detail={card.ref}
                    status={<Pill pill={card.pill} />}
                  >
                    <Line>{card.title}</Line>
                    <Line quiet>{card.reported}</Line>
                  </MachineCard>
                </Link>
              </li>
            ))}
          </ul>
          <LoadMore more={model.more} onMore={on.more} />
        </div>
      ) : (
        <FloorStates state={model.state} empty={model.empty} onRetry={on.retry ?? on.more} />
      )}
    </FloorPanel>
  );
}

export type SheetActions = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: (text: string) => void;
  send: () => void;
};

/** The "Not fixed" sheet (dialog "Not fixed"): note, "What is still wrong?" (maxlength), Send back, Cancel. */
export function DisputeSheetView(p: { model: DisputeModel; on: SheetActions }): ReactNode {
  const { model, on } = p;
  return (
    <BottomSheet open={on.open} onOpenChange={on.onOpenChange} title={model.title}>
      {model.refused ? (
        <>
          <Line strong>{model.refused.title}</Line>
          {model.refused.reported ? <Line quiet>{model.refused.reported}</Line> : null}
          <Line quiet>{model.refused.body}</Line>
        </>
      ) : (
        <Line>{model.note}</Line>
      )}
      <div className="v2-floor-field-group">
        <FieldLabel htmlFor={model.reasonId}>{model.reasonLabel}</FieldLabel>
        <TextArea
          id={model.reasonId}
          maxLength={model.maxLength}
          onChange={(e) => on.reason(e.target.value)}
        />
        <Line quiet>{model.hint}</Line>
      </div>
      {model.error ? <Line bad>{model.error}</Line> : null}
      <Actions>
        {model.refused ? (
          <Button onClick={() => on.onOpenChange(false)}>{model.back}</Button>
        ) : (
          <>
            <Button primary disabled={!model.ready} onClick={on.send}>
              {model.send}
            </Button>
            <Button onClick={() => on.onOpenChange(false)}>{model.cancel}</Button>
          </>
        )}
      </Actions>
    </BottomSheet>
  );
}

/** The "Cancel the ticket" sheet: "Why cancel?", the error, "Cancel ticket". */
export function CancelSheetView(p: { model: CancelModel; on: SheetActions }): ReactNode {
  const { model, on } = p;
  return (
    <BottomSheet open={on.open} onOpenChange={on.onOpenChange} title={model.title}>
      <div className="v2-floor-field-group">
        <FieldLabel htmlFor={model.reasonId}>{model.reasonLabel}</FieldLabel>
        <TextArea id={model.reasonId} onChange={(e) => on.reason(e.target.value)} />
      </div>
      {model.error ? <Line bad>{model.error}</Line> : null}
      <Actions>
        <Button danger disabled={!model.ready} onClick={on.send}>
          {model.submit}
        </Button>
      </Actions>
    </BottomSheet>
  );
}
