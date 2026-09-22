/** Person-name compare key: trim, case-fold, drop apostrophes, collapse space. */
export function normalizeName(raw: string | null | undefined): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ");
}
