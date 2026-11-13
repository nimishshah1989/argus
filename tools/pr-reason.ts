export type ReasonKey = 'Large PR' | 'No parity';

const MIN_CHARS = 10;

/** The reason a PR author wrote as a `<key>: <reason>` line in the PR description, or null. */
export function prReason(body: string | undefined, key: ReasonKey): string | null {
  const text = (body ?? '').replace(/<!--[\s\S]*?-->/g, '');
  const line = new RegExp(`^[ \\t]*(?:[-*][ \\t]+)?${key}[ \\t]*:[ \\t]*(.+)$`, 'im');
  const reason = line.exec(text)?.[1]?.trim() ?? '';
  return reason.replace(/\s/g, '').length >= MIN_CHARS ? reason : null;
}
