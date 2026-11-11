import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  addTicketTag,
  getTagCatalogue,
  getTicketTags,
  removeTicketTag,
  type TagDefinition,
  type TagList,
} from '../../api.js';
import { errorMessage } from '../format.js';
import { TagList as AppliedTagList } from './TagPill.js';
import { TagSelector } from './TagSelector.js';
import { mergeAvailableTags } from './logic.js';

function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-2 text-xs text-red-700">
      {errorMessage(error)}
    </p>
  );
}

function AppliedTags({ tags }: { tags: TagDefinition[] }) {
  const { t } = useTranslation();
  if (tags.length === 0) return <p className="mt-1 text-sm text-neutral-700">{t('tags.none')}</p>;
  return (
    <div className="mt-2">
      <AppliedTagList tags={tags} />
    </div>
  );
}

interface EditorProps {
  canEdit: boolean;
  available: TagDefinition[];
  applied: ReadonlySet<string>;
  pending: boolean;
  error: unknown;
  onToggle: (tagId: string) => void;
}

function TagEditor(props: EditorProps) {
  const { t } = useTranslation();
  if (!props.canEdit) return null;
  if (props.available.length === 0) {
    return <p className="mt-2 text-sm text-neutral-700">{t('tags.noOptions')}</p>;
  }
  return (
    <>
      <TagSelector
        available={props.available}
        applied={props.applied}
        pending={props.pending}
        onToggle={props.onToggle}
      />
      <ErrorText error={props.error} />
    </>
  );
}

export function TagsPanel({ ticketId, canEdit }: { ticketId: string; canEdit: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['ticket-tags', ticketId];
  const catalogue = useQuery({ queryKey: ['tag-catalogue'], queryFn: getTagCatalogue });
  const ticketTags = useQuery({ queryKey, queryFn: () => getTicketTags(ticketId) });
  const applied = ticketTags.data?.applied ?? [];
  const saved = useMutation({
    mutationFn: (tagId: string) =>
      applied.some((tag) => tag.tagId === tagId)
        ? removeTicketTag(ticketId, tagId)
        : addTicketTag(ticketId, tagId),
    onSuccess: (next: TagList) => {
      queryClient.setQueryData(queryKey, next);
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
    },
  });
  const loadError = catalogue.error ?? ticketTags.error;
  const loading = catalogue.isPending || ticketTags.isPending;
  const available =
    catalogue.data && ticketTags.data
      ? mergeAvailableTags(catalogue.data.tags, ticketTags.data.tags)
      : [];
  return (
    <section
      aria-label={t('tags.title')}
      className="mt-3 rounded-md border border-neutral-200 bg-white p-3"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
        {t('tags.title')}
      </h2>
      {loadError ? (
        <ErrorText error={loadError} />
      ) : loading ? (
        <p role="status" className="mt-2 text-sm text-neutral-700">
          {t('tags.loading')}
        </p>
      ) : (
        <>
          <AppliedTags tags={ticketTags.data?.tags ?? []} />
          <TagEditor
            canEdit={canEdit}
            available={available}
            applied={new Set(applied.map((tag) => tag.tagId))}
            pending={saved.isPending}
            error={saved.error}
            onToggle={(tagId) => saved.mutate(tagId)}
          />
        </>
      )}
    </section>
  );
}
