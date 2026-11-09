export function num(value: { toNumber(): number } | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return typeof value === 'number' ? value : value.toNumber();
}

export function numOrNull(value: { toNumber(): number } | number | null | undefined): number | null {
  return value === null || value === undefined ? null : num(value);
}
