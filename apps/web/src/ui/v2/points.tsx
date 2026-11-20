/**
 * What a piece of text means, said by its colour and always by its words too: a loss, a gain, a risk, a plan, a
 * decision only an owner can take, or just weight (`strong`, bold without a colour).
 */
export type Tone = 'strong' | 'loss' | 'gain' | 'risk' | 'plan' | 'decide';
export type Seg = { text: string; tone?: Tone };
/** One sentence of an explanation, built by the engine from segments, never from markup. */
export type Point = Seg[];

/** The segments of one sentence, inline; the tones are bold and coloured by `v2.css`. */
export function Segs({ point }: { point: Point }) {
  return point.map((seg, i) =>
    seg.tone ? (
      <b key={i} className={`v2-seg v2-seg-${seg.tone}`}>
        {seg.text}
      </b>
    ) : (
      <span key={i}>{seg.text}</span>
    ),
  );
}

/** Short bullet points; `well` sets them on the soft grey box of an opened row. */
export function Points({ points, well = false }: { points: Point[]; well?: boolean }) {
  return (
    <ul className={well ? 'v2-points v2-points-well' : 'v2-points'}>
      {points.map((point, i) => (
        <li key={i}>
          <Segs point={point} />
        </li>
      ))}
    </ul>
  );
}
