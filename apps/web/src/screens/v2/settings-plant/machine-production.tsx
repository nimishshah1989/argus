/* eslint-disable i18next/no-literal-string -- query keys, roles and class names only; every visible word goes through t() */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { MachineReply } from '@uptimo/shared/plant-settings';
import { putMachineProduction } from '../../../api.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';

/**
 * A machine can be left out of production data (BD %, MTTR, MTBF, availability) from Settings -> Machines.
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
  return <KeyPill text={t('plant.machines.production.tag')} tone="neutral" icon="stop" />;
}

/** The labelled switch: a real `switch` so keys and screen readers work. */
export function ProductionSwitch({ row }: { row: MachineReply }) {
  const { t } = useTranslation();
  const save = useProductionSwitch(row);
  const on = row.excludedFromProduction;
  return (
    <div className="v2-stack">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-busy={save.isPending}
        aria-label={t('plant.machines.production.switchFor', { name: row.code })}
        className="v2-switch"
        onClick={() => {
          if (!save.isPending) save.mutate(!on);
        }}
      >
        {t('plant.machines.production.switch')}
        <span aria-hidden className="v2-switch-track" />
      </button>
      {save.isError ? (
        <p role="alert" className="v2-seg v2-seg-loss">
          {t('plant.machines.production.error', { name: row.code })}
        </p>
      ) : null}
    </div>
  );
}
