/**
 * Planner day board: rules for the hour grid and for what may be dragged. Pure — safe for node --test.
 */
export type BoardType = "service" | "tlc" | "pm" | "install";

/** First and last hour columns (7a … 9p). The page shows about 7a–7p; later hours are a scroll to the right. */
export const BOARD_FIRST_HOUR = 7;
export const BOARD_LAST_HOUR = 21;
export const BOARD_HOURS: number[] = Array.from({ length: BOARD_LAST_HOUR - BOARD_FIRST_HOUR + 1 }, (_, i) => BOARD_FIRST_HOUR + i);

/** "HH:MM" (24-hour) or null when the text is not a time. Accepts "7:30", "07:30", "7:30:00". */
export function cleanTime(raw: string | null | undefined): string | null {
  const m = /^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*$/.exec(raw ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "07:30" → "7:30a"; "13:00" → "1p"; "12:00" → "12p". */
export function timeLabel(time: string | null | undefined): string {
  const t = cleanTime(time);
  if (!t) return "";
  const h = Number(t.slice(0, 2));
  const min = t.slice(3);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${min === "00" ? "" : `:${min}`}${h < 12 ? "a" : "p"}`;
}
export const hourLabel = (hour: number) => timeLabel(`${hour}:00`);

/** The hour column a time sits in. Earlier than the first column or later than the last sits at that edge. */
export function hourColumn(time: string | null | undefined): number | null {
  const t = cleanTime(time);
  if (!t) return null;
  return Math.min(BOARD_LAST_HOUR, Math.max(BOARD_FIRST_HOUR, Number(t.slice(0, 2))));
}

/** A drop in the left half of an hour is on the hour; the right half is half past. */
export function dropTime(hour: number, fraction: number): string {
  return `${String(hour).padStart(2, "0")}:${fraction >= 0.5 ? "30" : "00"}`;
}

const CLOSED = new Set(["completed", "cancelled", "canceled", "phone resolved", "installed"]);

/** Completed and cancelled work stays where it was done: it shows on the board but does not move. */
export function boardLocked(row: { status?: string | null; done?: boolean | null }): boolean {
  return !!row.done || CLOSED.has(String(row.status ?? "").trim().toLowerCase());
}

export type BoardMove = { date: string; time: string | null; technician: string | null };

/** What a drop changes, or null when the block was dropped where it already is. */
export function boardMove(from: BoardMove, to: BoardMove): BoardMove | null {
  const same = from.date === to.date && cleanTime(from.time) === cleanTime(to.time) && (from.technician ?? "") === (to.technician ?? "");
  return same ? null : { date: to.date, time: cleanTime(to.time), technician: to.technician || null };
}
