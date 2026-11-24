/**
 * The database refuses a new duplicate serial (migration 0137, Chuy 11/23): a customer machine with a serial another
 * customer machine has, or a warehouse record with a serial another unsold warehouse record has. The error has SQLSTATE
 * KZ001 and a message that names where the serial already is.
 */
export const SERIAL_CLASH_CODE = "KZ001";

/** The refusal's message when `e` is that refusal, otherwise null. */
export function serialClashMessage(e: unknown): string | null {
  const err = e as { code?: unknown; message?: unknown } | null;
  const message = typeof err?.message === "string" ? err.message : "";
  if (err?.code === SERIAL_CLASH_CODE) return message || "That serial is already on another unit.";
  return /^Serial .+ is already on /.test(message) ? message : null;
}
