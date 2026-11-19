import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { MachineReply } from '@uptimo/shared/plant-settings';
import { putMachineProduction } from '../../api.js';
import { Ban, TriangleAlert } from '../../ui/icon.js';
import { TONE_FILL, TONE_TEXT } from '../../ui/meaning.js';

/**
 * Ticket 77b: a machine can be left out of production data (BD %, MTTR, MTBF, availability) from Settings -> Machines.
 * The switch saves at once through `PUT /machines/:id/production-data`: the row flips first, and flips back with a
 * line saying so when the save fails.
 */

const KEY = ['machines'] as const;

/** The same list rows in either cache shape (the paged list or the plain lookup), with one machine's switch set. */
function withSwitch(data: unknown, id: string, value: boolean): unknown {
  if (Array.isArray(data))
    return data.map((row: MachineReply) =>
      row.id === id ? { ...row, excludedFromProduction: value } : row,
    );
  if (data && typeof data === 'object' && 'pages' in data)
    return {
      ...data,
      pages: (data as { pages: { items: unknown }[] }).pages.map((page) => ({
        ...page,
        items: withSwitch(page.items, id, value),
      })),
    };
  return data;
}

function useProductionSwitch(row: MachineReply) {
  const client: QueryClient = useQueryClient();
  return useMutation({
    mutationFn: (next: boolean) => putMachineProduction(row.id, next),
    onMutate: async (next) => {
      await client.cancelQueries({ queryKey: KEY });
      const before = client.getQueriesData({ queryKey: KEY });
      client.setQueriesData({ queryKey: KEY }, (data) => withSwitch(data, row.id, next));
      return { before };
    },
    onError: (_error, _next, context) => {
      for (const [key, data] of context?.before ?? []) client.setQueryData(key, data);
    },
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

/** The tag a machine that is out carries on its row: icon and words, never colour alone. */
export function ProductionTag({ row }: { row: MachineReply }) {
  const { t } = useTranslation();
  if (!row.excludedFromProduction) return null;
  return (
    <span
      className={`mt-1 inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-caption font-semibold ${TONE_FILL.muted}`}
    >
      <Ban aria-hidden size={14} />
      {t('plant.machines.production.tag')}
    </span>
  );
}

/** The labelled switch: 44 px tall tap target around a 31 px pill, a real `switch` so keys and screen readers work. */
export function ProductionSwitch({ row, boxed }: { row: MachineReply; boxed?: boolean }) {
  const { t } = useTranslation();
  const save = useProductionSwitch(row);
  const on = row.excludedFromProduction;
  return (
    <div className={boxed ? 'flex flex-col' : 'flex flex-col pb-2'}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-busy={save.isPending}
        aria-label={t('plant.machines.production.switchFor', { name: row.code })}
        onClick={() => {
          if (!save.isPending) save.mutate(!on);
        }}
        className="flex min-h-target-min w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-footnote font-medium">{t('plant.machines.production.switch')}</span>
        <span
          className={`relative block h-[31px] w-[51px] flex-none rounded-full ${on ? 'bg-accent-strong' : 'bg-neutral-200'}`}
        >
          <span
            className={`absolute top-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-card ${on ? 'left-[22px]' : 'left-0.5'}`}
          />
        </span>
      </button>
      {save.isError ? (
        <p
          role="alert"
          className={`flex items-start gap-1.5 text-footnote font-medium ${TONE_TEXT.danger}`}
        >
          <TriangleAlert aria-hidden size={16} className="mt-0.5 flex-none" />
          {t('plant.machines.production.error', { name: row.code })}
        </p>
      ) : null}
    </div>
  );
}
