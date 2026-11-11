const TONES: Record<string, string> = {
  S1: 'bg-red-100 text-red-800',
  S2: 'bg-orange-100 text-orange-800',
  S3: 'bg-amber-100 text-amber-800',
  S4: 'bg-neutral-200 text-neutral-600',
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
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {severity}
    </span>
  );
}
