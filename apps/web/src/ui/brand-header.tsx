/** Whose plant this is (sign-in): a logo tile, the company, one line under it. With no logo the tile shows the initial. */
export function BrandHeader({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-neutral-200 text-title3 font-bold text-neutral-700"
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="flex flex-col">
        <span className="text-title3 font-bold text-neutral-900">{name}</span>
        <span className="text-footnote text-neutral-600">{detail}</span>
      </span>
    </div>
  );
}
