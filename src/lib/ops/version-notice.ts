/**
 * Is a newer build live than the one this tab is running (11/16)? A tab left open through a publish keeps the old
 * script until it reloads. Only real commits are compared: "dev", "unknown" or a blank never raise the notice, and a
 * short sha matches its full one.
 */
const isSha = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{7,40}$/i.test(s);

export function newerBuildLive(mine: string | null | undefined, live: string | null | undefined): boolean {
  if (!isSha(mine) || !isSha(live)) return false;
  const a = mine.toLowerCase();
  const b = live.toLowerCase();
  return !(a.startsWith(b) || b.startsWith(a));
}
