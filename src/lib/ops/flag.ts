/** Postgres / form flags that arrive as bool, 0/1, or t/f text. */
export function flagOn(value: unknown): boolean {
  return value === true || value === 1 || value === "t" || value === "true" || value === "1";
}
