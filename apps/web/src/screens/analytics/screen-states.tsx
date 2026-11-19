/* eslint-disable i18next/no-literal-string -- the template's kind and state are prop values, not copy */
import { Template } from './shell/patterns/template.js';

/**
 * A screen's frame with its state line in place of the content: the error with Retry, the empty answer (a missing
 * record is empty, not loading), offline, or loading. Shared by the Today tabs so each states them the same way.
 */
export function NotReady({
  title,
  state,
  emptyText,
  onRetry,
}: {
  title: string;
  state: string;
  emptyText: string;
  onRetry: () => void;
}) {
  if (state === 'error')
    return <Template title={title} kind="overview" state="error" onRetry={onRetry} main={null} />;
  if (state === 'empty')
    return <Template title={title} kind="overview" state="empty" empty={emptyText} main={null} />;
  return (
    <Template
      title={title}
      kind="overview"
      state={state === 'offline' ? 'offline' : 'loading'}
      main={null}
    />
  );
}
