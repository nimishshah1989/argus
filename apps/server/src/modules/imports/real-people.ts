/** Names as Bhavin's app wrote them: "Asha K (Maintenance)", "Asha K, Ravi M", or only a role ("Operator"). */
const ROLE_SUFFIX = /\s*\(([^)]*)\)\s*$/;
const ROLE_ONLY =
  /^(?:operator|engineer|setter|supervisor|maintenance|maint|shop floor|platform|admin|store)?$/i;
const SPLIT = /\s*(?:,|&|\+|\/|\band\b)\s*/i;

export function personName(raw: string): string | null {
  const name = raw.replace(ROLE_SUFFIX, '').replace(/\s+/g, ' ').trim();
  return ROLE_ONLY.test(name) ? null : name;
}

export function personRole(raw: string): string | null {
  return (
    ROLE_SUFFIX.exec(raw)?.[1]?.trim() || (ROLE_ONLY.test(raw.trim()) ? raw.trim() || null : null)
  );
}

/** "Asha K, Ravi M" is two people. */
export function personList(raw: string): string[] {
  return raw
    .split(SPLIT)
    .map(personName)
    .filter((name): name is string => name !== null);
}
