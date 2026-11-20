/** Domain kit: a thing's facts, each a label over its value, as many to a row as fit; a note sits under what it explains. */
export type FactData = { id: string; label: string; value: string; note?: string };

export function FactList({ facts }: { facts: FactData[] }) {
  return (
    <dl className="v2-facts">
      {facts.map((fact) => (
        <div key={fact.id}>
          <dt className="v2-sub">{fact.label}</dt>
          <dd className="v2-fact-value">{fact.value}</dd>
          {fact.note ? <dd className="v2-sub">{fact.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
