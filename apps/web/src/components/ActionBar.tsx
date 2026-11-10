import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommandAction, CommandBody, Config, Ticket } from '../api.js';
import { legalActions } from './actions.js';
import { ActionForm } from './ActionForm.js';

const FORM_ACTIONS = new Set<CommandAction>(['pause', 'update', 'transfer', 'close', 'cancel']);

interface Props {
  ticket: Ticket;
  config: Config;
  personId: string;
  error: string | null;
  pending: boolean;
  onRun: (action: CommandAction, body: CommandBody) => Promise<boolean>;
}

/** Only the actions legal from this status (DOMAIN.md §2); one of them is primary. */
export function ActionBar({ ticket, config, personId, error, pending, onRun }: Props) {
  const { t } = useTranslation();
  const [openForm, setOpenForm] = useState<CommandAction | null>(null);
  const actions = legalActions(ticket);
  if (actions.length === 0) return null;

  function choose(action: CommandAction) {
    if (FORM_ACTIONS.has(action)) {
      setOpenForm(action);
      return;
    }
    void onRun(action, { personId });
  }

  return (
    <section aria-label={t('action.aria')} className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">{t('action.aria')}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {actions.map((item) => (
          <button
            key={item.action}
            type="button"
            disabled={pending}
            onClick={() => choose(item.action)}
            className={`min-h-13 rounded-xl px-3 text-base font-semibold disabled:opacity-50 ${
              item.primary
                ? 'bg-accent text-white hover:bg-accent/90'
                : 'border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {openForm && (
        <ActionForm
          action={openForm}
          personId={personId}
          kind={ticket.kind}
          config={config}
          pending={pending}
          onRun={onRun}
          onDone={() => setOpenForm(null)}
        />
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-stopped/10 p-3 text-stopped">
          {error}
        </p>
      )}
    </section>
  );
}
