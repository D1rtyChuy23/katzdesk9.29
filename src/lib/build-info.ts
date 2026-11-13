/**
 * Which build is running (Chuy, 11/13): the commit and when it was built, set by vite.config.ts at build time, so a
 * tester can check the deploy on Settings. Outside a Vite build (node --test) it reads "dev".
 */
declare const __KATZ_BUILD__: { sha: string; builtAt: string } | undefined;

export const BUILD: { sha: string; builtAt: string } = typeof __KATZ_BUILD__ === "undefined" ? { sha: "dev", builtAt: "" } : __KATZ_BUILD__;

/** The commit as people compare it: its first 7 characters, or the word the build had ("dev", "unknown"). */
export function shortSha(sha: string): string {
  return /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 7).toLowerCase() : sha;
}

/** "Build 60c5dbd · built Nov 13, 2026, 1:18 AM" (Chicago time), or "Build dev" with no build time. */
export function buildLine(b: { sha: string; builtAt: string } = BUILD): string {
  const at = b.builtAt ? new Date(b.builtAt) : null;
  const when =
    at && !Number.isNaN(at.getTime())
      ? at.toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
      : "";
  return `Build ${shortSha(b.sha)}${when ? ` · built ${when}` : ""}`;
}
