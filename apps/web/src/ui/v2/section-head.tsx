/** A heading over a group of cards, with one quiet line saying what the group covers. */
export function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="v2-h2">{title}</h2>
      {sub ? <p className="v2-sub">{sub}</p> : null}
    </div>
  );
}
