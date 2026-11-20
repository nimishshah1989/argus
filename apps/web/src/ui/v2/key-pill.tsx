/** What a pill means; the word on it says it too, so colour never carries it alone. */
export type PillTone = 'loss' | 'gain' | 'risk' | 'plan' | 'decide';

/** A key pointer visible without clicking: a short word or number on a soft tint. */
export function KeyPill({ text, tone }: { text: string; tone: PillTone }) {
  return <span className={`v2-pill v2-pill-${tone}`}>{text}</span>;
}
