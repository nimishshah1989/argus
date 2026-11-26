/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible word comes from the model */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PatternFrame, StateNotice } from '../../../patterns/frame.js';
import { Button } from '../../../ui/button.js';
import { MachineCard } from '../../../ui/floor-pieces.js';
import { Label, Textarea } from '../../../ui/input.js';
import { Grid, Stack } from '../../../ui/layout.js';
import { Sheet } from '../../../ui/sheet.js';
import { StatusPill } from '../../../ui/status/status-pill.js';
import { Text } from '../../../ui/text.js';
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
 * Reuses `MachineCard` (`ui/floor-pieces`), `StatusPill`, `Button`, `Sheet`, `Label`/`Textarea`, `PatternFrame`/`StateNotice`,
 * and the kit `Takeaway` (`ui/v2/takeaway`).
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
    <Stack gap={1}>
      <Takeaway data={takeaway} />
      <Text size="footnote" tone="secondary">
        {takeaway.yardstick}
      </Text>
    </Stack>
  );
}

function LoadMore({ more, onMore }: { more: More; onMore: () => void }) {
  return more ? (
    <Button variant="secondary" disabled={more.busy} onClick={onMore}>
      {more.label}
    </Button>
  ) : null;
}

function Signoff(p: { id: string; signoff: SignoffModel; on: Pick<MineActions, 'yes' | 'no'> }) {
  const { signoff } = p;
  if (signoff.kind === 'answered')
    return (
      <>
        {signoff.lines.map((line) => (
          <Text
            key={line.text}
            size={line.quiet ? 'footnote' : undefined}
            tone={line.quiet ? 'secondary' : undefined}
          >
            {line.text}
          </Text>
        ))}
      </>
    );
  return (
    <Stack gap={3}>
      <Text as="h3" weight="bold">
        {signoff.title}
      </Text>
      {signoff.body ? <Text>{signoff.body}</Text> : null}
      {signoff.error ? <Text tone="danger">{signoff.error}</Text> : null}
      <Grid columns={2} gap={2}>
        <Button disabled={signoff.busy} onClick={() => p.on.yes(p.id)}>
          {signoff.yes}
        </Button>
        <Button variant="secondary" onClick={() => p.on.no(p.id)}>
          {signoff.no}
        </Button>
      </Grid>
    </Stack>
  );
}

function Complaint({ card, on }: { card: MineModel['cards'][number]; on: MineActions }) {
  return (
    <MachineCard code={card.place} status={<Pill pill={card.pill} />}>
      <Text size="footnote" weight="bold" tone={card.stopped ? 'danger' : 'secondary'}>
        {card.kindLine}
      </Text>
      <Text>{card.problem}</Text>
      <Text size="footnote" tone="secondary">
        {card.reported}
      </Text>
      {card.signoff ? <Signoff id={card.id} signoff={card.signoff} on={on} /> : null}
      {card.cancel ? (
        <Button variant="quiet-danger" onClick={() => on.cancel(card.id)}>
          {card.cancel}
        </Button>
      ) : null}
    </MachineCard>
  );
}

/** `/floor/mine`: takeaway, then each card as a list item (`li`) carrying its REF, then Load more. */
export function MineView(p: { model: MineModel; on: MineActions }): ReactNode {
  const { model, on } = p;
  return (
    <PatternFrame title={model.title} quietOnline>
      {model.state === 'ready' ? (
        <Stack gap={3}>
          <Opening takeaway={model.takeaway} />
          <ul className="flex flex-col gap-3">
            {model.cards.map((card) => (
              <li key={card.id}>
                <Complaint card={card} on={on} />
              </li>
            ))}
          </ul>
          <LoadMore more={model.more} onMore={on.more} />
        </Stack>
      ) : (
        <StateNotice state={model.state} empty={model.empty} onRetry={on.retry ?? on.more} />
      )}
    </PatternFrame>
  );
}

/** `/floor/pm`: takeaway and hint, then each job as one link to `/desk/:id`, then Load more. */
export function PmJobsView(p: {
  model: PmModel;
  on: { more: () => void; retry?: () => void };
}): ReactNode {
  const { model, on } = p;
  return (
    <PatternFrame title={model.title} quietOnline>
      {model.state === 'ready' ? (
        <Stack gap={3}>
          <Opening takeaway={model.takeaway} />
          <Text size="footnote" tone="secondary">
            {model.hint}
          </Text>
          <ul className="flex flex-col gap-3">
            {model.cards.map((card) => (
              <li key={card.id}>
                <Link to={card.href}>
                  <MachineCard
                    code={card.code}
                    detail={card.ref}
                    status={<Pill pill={card.pill} />}
                  >
                    <Text>{card.title}</Text>
                    <Text size="footnote" tone="secondary">
                      {card.reported}
                    </Text>
                  </MachineCard>
                </Link>
              </li>
            ))}
          </ul>
          <LoadMore more={model.more} onMore={on.more} />
        </Stack>
      ) : (
        <StateNotice state={model.state} empty={model.empty} onRetry={on.retry ?? on.more} />
      )}
    </PatternFrame>
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
    <Sheet open={on.open} onOpenChange={on.onOpenChange} title={model.title}>
      <Stack gap={3}>
        {model.refused ? (
          <>
            <Text weight="bold">{model.refused.title}</Text>
            {model.refused.reported ? (
              <Text size="footnote" tone="secondary">
                {model.refused.reported}
              </Text>
            ) : null}
            <Text size="footnote" tone="secondary">
              {model.refused.body}
            </Text>
          </>
        ) : (
          <Text>{model.note}</Text>
        )}
        <Label htmlFor={model.reasonId}>{model.reasonLabel}</Label>
        <Textarea
          id={model.reasonId}
          maxLength={model.maxLength}
          onChange={(e) => on.reason(e.target.value)}
        />
        <Text size="footnote" tone="secondary">
          {model.hint}
        </Text>
        {model.error ? <Text tone="danger">{model.error}</Text> : null}
        {model.refused ? (
          <Button onClick={() => on.onOpenChange(false)}>{model.back}</Button>
        ) : (
          <>
            <Button disabled={!model.ready} onClick={on.send}>
              {model.send}
            </Button>
            <Button variant="quiet" onClick={() => on.onOpenChange(false)}>
              {model.cancel}
            </Button>
          </>
        )}
      </Stack>
    </Sheet>
  );
}

/** The "Cancel the ticket" sheet: "Why cancel?", the error, "Cancel ticket". */
export function CancelSheetView(p: { model: CancelModel; on: SheetActions }): ReactNode {
  const { model, on } = p;
  return (
    <Sheet open={on.open} onOpenChange={on.onOpenChange} title={model.title}>
      <Stack gap={3}>
        <Label htmlFor={model.reasonId}>{model.reasonLabel}</Label>
        <Textarea id={model.reasonId} onChange={(e) => on.reason(e.target.value)} />
        {model.error ? <Text tone="danger">{model.error}</Text> : null}
        <Button disabled={!model.ready} onClick={on.send}>
          {model.submit}
        </Button>
      </Stack>
    </Sheet>
  );
}
