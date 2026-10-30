/** A ticket's merged state as service_jobs stores it. */
export type MergedTicketRow = { duplicate_of: number | null; merged_install_id?: number | null };

/**
 * Why a write is refused on a merged ticket, or null when it isn't merged. One merged into an install (10/30) points
 * at the install; one merged into another ticket keeps its old wording, finished by `there` ("Add charges there.").
 */
export function mergedTicketRefusal(row: MergedTicketRow | null | undefined, there = ""): string | null {
  if (!row) return null;
  if (row.merged_install_id) return `This ticket was merged into install #${row.merged_install_id}. Its work is on the install now.`;
  if (row.duplicate_of) return `This ticket was merged into #${row.duplicate_of}.${there ? ` ${there}` : ""}`;
  return null;
}
