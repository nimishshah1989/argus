/** What the last save did: a polite line when it landed, an announced one when it failed; nothing before a save. */
export function SaveNote(p: { note: 'saved' | 'failed' | null; saved: string; failed: string }) {
  if (p.note === 'saved')
    return (
      <p role="status" className="v2-crud-hint">
        {p.saved}
      </p>
    );
  if (p.note === 'failed')
    return (
      <p role="alert" className="v2-crud-hint">
        {p.failed}
      </p>
    );
  return null;
}
