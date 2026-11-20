/** A headline figure: a small label, the value at hero size, and a note under it. */
export type Figure = { label: string; value: string; note: string; tone?: 'gain' | 'loss' };

export function MoneyFigure({ figure }: { figure: Figure }) {
  return (
    <div className="v2-figure">
      <div className="v2-note">{figure.label}</div>
      <div className={figure.tone ? `v2-hero v2-seg-${figure.tone}` : 'v2-hero'}>
        {figure.value}
      </div>
      <div className="v2-note v2-num">{figure.note}</div>
    </div>
  );
}
