export function nextRef(prefix: string, current: number): string {
  return `${prefix}-${String(current).padStart(4, '0')}`;
}
