const TONES: Record<string, string> = {
  S1: 'bg-danger-tint text-danger-ink',
  S2: 'bg-hold-tint text-hold-ink',
  S3: 'bg-warning-tint text-warning-ink',
  S4: 'bg-muted-tint text-muted-ink',
};

/**
 * Severity badge for a ticket (M2-2.1).
 * Colour never carries meaning alone: the S1–S4 label is always shown.
 */
export function SeverityBadge({ severity }: { severity: string | null | undefined }) {
  if (!severity) return null;
  const tone = TONES[severity] ?? TONES.S4;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-caption font-semibold ${tone}`}
    >
      {severity}
    </span>
  );
}
