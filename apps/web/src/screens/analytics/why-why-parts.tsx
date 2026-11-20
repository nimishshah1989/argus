import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { WhyWhyPayload, WhyWhyWrite } from '@uptimo/shared/why-why';
import { canAnalytics, type ActorContext, type Role } from '@uptimo/domain';
import { getWhyWhy, saveWhyWhy } from '../../api.js';
import { downloadFile } from '../../data/index.js';
import { Button } from '../../ui/button.js';
import { Label, Textarea } from '../../ui/input.js';
import { CircleCheck, CircleHelp, Download } from '../../ui/icon.js';
import { TONE_FILL } from '../../ui/meaning.js';
import type { PageContent } from './page-content.js';
import { SortTable } from './sort-table.js';

/** The pieces of the A6 screen that are not the page itself (41e-2): its badge, form, row actions and state. */
export type Table = PageContent['tables'][number];
export type Whys = WhyWhyWrite['whys'];
export type Choice = {
  ticketId: string;
  machine: string;
  date: string;
  completed: boolean;
  record: WhyWhyPayload | null;
};
export interface Viewer {
  role: string;
  id: string;
  name: string;
  actingPersonId: string;
  shared: boolean;
  cell?: string | null;
  actingPerson?: { name: string } | null;
}

const BLANK: Whys = ['', '', '', '', ''];
const SECONDARY = 'secondary';
const QUIET = 'quiet';

/** The signed-in person, as the server names them beside the record it will write. */
export function shownName(user: Viewer | undefined): string {
  return user === undefined ? '' : (user.actingPerson?.name ?? user.name);
}

/** R3's write guard, read from the same predicate the Why-Why routes use: only the analytics roles save. */
export function mayWrite(user: Viewer | undefined): boolean {
  if (user === undefined) return false;
  const actor: ActorContext = {
    role: user.role as Role,
    loginId: user.id,
    personId: user.actingPersonId || null,
    shared: user.shared,
    cell: user.cell ?? null,
  };
  return canAnalytics(actor);
}

/** Colour never carries meaning alone: the status is an icon and the engine's own word. */
function StatusBadge({ complete, label }: { complete: boolean; label: string }) {
  const Icon = complete ? CircleCheck : CircleHelp;
  const tone = complete ? TONE_FILL.ok : TONE_FILL.muted;
  return (
    <span
      data-candidate-status={complete ? 'completed' : 'not-started'}
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-caption font-bold ${tone}`}
    >
      <Icon aria-hidden size={16} />
      {label}
    </span>
  );
}

/** The five whys: each is a cause the team can leave blank; the conclusion is the one required field. */
function WhyFields({
  whys,
  onChange,
}: {
  whys: Whys;
  onChange: (index: number, value: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <>
      {whys.map((why, index) => (
        <div key={index} className="flex flex-col gap-1">
          <Label htmlFor={`${id}-why-${index}`}>
            {t('analytics.whyWhy.why', { number: index + 1 })}
          </Label>
          <Textarea
            id={`${id}-why-${index}`}
            value={why}
            onChange={(event) => onChange(index, event.target.value)}
          />
        </div>
      ))}
    </>
  );
}

/** The draft a saved record opens with: its five whys and its conclusion, or five blanks. */
function useWhyDraft(choice: Choice) {
  const [whys, setWhys] = useState<Whys>(choice.record?.whys ?? BLANK);
  const [conclusion, setConclusion] = useState(choice.record?.conclusion ?? '');
  const setWhy = (index: number, value: string) =>
    setWhys((current) => {
      const next: [string, string, string, string, string] = [
        current[0],
        current[1],
        current[2],
        current[3],
        current[4],
      ];
      next[index] = value;
      return next;
    });
  return { whys, conclusion, setWhy, setConclusion };
}

function FormHeading({ choice, author }: { choice: Choice; author: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-title3 font-semibold">{t('analytics.whyWhy.title')}</h2>
      <p className="text-footnote text-neutral-600">
        {choice.machine} · {choice.date}
      </p>
      <p className="text-footnote font-medium text-neutral-700">
        {t('analytics.whyWhy.author', { name: author })}
      </p>
    </div>
  );
}

function FormFooter({
  completed,
  saving,
  disabled,
  onCancel,
  onPdf,
}: {
  completed: boolean;
  saving: boolean;
  disabled: boolean;
  onCancel: () => void;
  onPdf: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" disabled={saving || disabled}>
        {t('analytics.whyWhy.save')}
      </Button>
      {completed ? (
        <Button variant={SECONDARY} onClick={onPdf}>
          <Download aria-hidden size={16} className="mr-1 inline" />
          {t('analytics.whyWhy.pdf')}
        </Button>
      ) : null}
      <Button variant={QUIET} onClick={onCancel}>
        {t('analytics.whyWhy.cancel')}
      </Button>
    </div>
  );
}

/** The record's form; the author is the signed-in person the server writes, never one typed here. */
export function WhyWhyForm({
  choice,
  author,
  saving,
  saved,
  onSave,
  onCancel,
  onPdf,
}: {
  choice: Choice;
  author: string;
  saving: boolean;
  saved: boolean;
  onSave: (body: WhyWhyWrite) => void;
  onCancel: () => void;
  onPdf: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const draft = useWhyDraft(choice);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (draft.conclusion.trim() !== '') onSave({ whys: draft.whys, conclusion: draft.conclusion });
  };
  return (
    <form
      aria-label={t('analytics.whyWhy.form')}
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card"
    >
      <FormHeading choice={choice} author={author} />
      <WhyFields whys={draft.whys} onChange={draft.setWhy} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-conclusion`}>{t('analytics.whyWhy.conclusion')}</Label>
        <Textarea
          id={`${id}-conclusion`}
          required
          value={draft.conclusion}
          onChange={(event) => draft.setConclusion(event.target.value)}
        />
      </div>
      {saved ? (
        <p role="status" className="text-footnote font-medium text-ok-ink">
          {t('analytics.whyWhy.saved')}
        </p>
      ) : null}
      <FormFooter
        completed={choice.completed}
        saving={saving}
        disabled={draft.conclusion.trim() === ''}
        onCancel={onCancel}
        onPdf={onPdf}
      />
    </form>
  );
}

/** The screen's own state: which row is open, the save, and the saved record's PDF. */
export function useWhyWhyRecord(rows: readonly (readonly string[])[]) {
  const client = useQueryClient();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [failure, setFailure] = useState<MessageKey | null>(null);
  const save = useMutation({
    mutationFn: (input: { ticketId: string; body: WhyWhyWrite }) =>
      saveWhyWhy(input.ticketId, input.body),
    onSuccess: async (record, input) => {
      setFailure(null);
      setChoice((current) =>
        current !== null && current.ticketId === input.ticketId
          ? { ...current, completed: true, record }
          : current,
      );
      await client.invalidateQueries({ queryKey: ['analytics-figures'] });
    },
    onError: () => setFailure('analytics.whyWhy.saveFailed'),
  });
  const open = async (ticketId: string, index: number, completed: boolean) => {
    save.reset();
    setFailure(null);
    const row = rows[index] ?? [];
    const base = { ticketId, machine: row[0] ?? '', date: row[1] ?? '', completed };
    if (!completed) {
      setChoice({ ...base, record: null });
      return;
    }
    try {
      setChoice({ ...base, record: await getWhyWhy(ticketId) });
    } catch {
      setFailure('analytics.whyWhy.loadFailed');
    }
  };
  const pdf = async () => {
    if (choice === null) return;
    setFailure(null);
    try {
      await downloadFile(
        `/api/v1/tickets/${encodeURIComponent(choice.ticketId)}/why-why.pdf`,
        `WhyWhy_${choice.machine}_${choice.date}.pdf`,
      );
    } catch {
      setFailure('analytics.whyWhy.pdfFailed');
    }
  };
  const close = () => {
    save.reset();
    setChoice(null);
  };
  return { choice, failure, save, open, pdf, close };
}

/** The ticket behind one row, from the figure's own per-row ids; null when the figure names none for that row. */
export function rowTicketId(table: Table, rowIndex: number): string | null {
  const id = table.rowTicketIds?.[rowIndex];
  return id === undefined || id === '' ? null : id;
}

/** A6's candidate table, with the row's own action in its last engine cell. */
export function Candidates({
  table,
  write,
  onPick,
}: {
  table: Table;
  write: boolean;
  onPick: (rowIndex: number, ticketId: string, completed: boolean) => void;
}) {
  const { t } = useTranslation();
  const header = table.header.map((cell, index) =>
    index === table.header.length - 1 && cell.trim() === '' ? t('analytics.whyWhy.action') : cell,
  );
  return (
    <SortTable
      title={table.title === '' ? null : table.title}
      header={header}
      rows={table.rows}
      renderCell={(cell, column, rowIndex) => {
        if (column === 4)
          return <StatusBadge complete={cell.trim() === 'Completed'} label={cell} />;
        if (column !== 5) return cell;
        if (!write) return null;
        // The drill ids are sorted, not in row order: the row's own ticket is the one the figure printed beside it.
        const ticketId = rowTicketId(table, rowIndex);
        if (ticketId === null) return null;
        const completed = (table.rows[rowIndex]?.[4] ?? '').trim() === 'Completed';
        return (
          <button
            type="button"
            onClick={() => onPick(rowIndex, ticketId, completed)}
            className="min-h-target-min whitespace-nowrap font-semibold text-accent-text"
          >
            {t(completed ? 'analytics.whyWhy.view' : 'analytics.whyWhy.start')}
          </button>
        );
      }}
    />
  );
}
