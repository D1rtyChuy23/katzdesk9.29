/**
 * When a page's data fails to load, say so instead of showing an empty list or zero counts (an empty board read as
 * "the installs are gone"). Pure: the banner (components/desk/load-problems.tsx) and the pages use it.
 */

export type LoadProblemKind = "signed-out" | "offline" | "server";

/** What kind of failure this is, and the server's own message. */
export function describeLoadError(err: unknown): { kind: LoadProblemKind; message: string } {
  const message = (err instanceof Error ? err.message : typeof err === "string" ? err : "") || "Unknown error";
  if (/unauthori[sz]ed|not signed in|signed out|sign in again|\b401\b/i.test(message)) return { kind: "signed-out", message };
  if (/failed to fetch|networkerror|network request failed|load failed|err_internet|err_network|\boffline\b/i.test(message)) {
    return { kind: "offline", message };
  }
  return { kind: "server", message };
}

/**
 * A refusal the page expects for some people ("Only Service and Admin can …"): not a failed load, so no banner.
 * Every other error is shown.
 */
export function isExpectedRefusal(message: string): boolean {
  return /^only\b/i.test(message.trim()) || /\bnot allowed\b|\bdon't have access\b|\bno access\b/i.test(message);
}

const NOUNS: Record<string, string> = {
  dashboard: "Coming Due",
  installs: "installs",
  customers: "customers",
  assets: "warehouse units",
  access: "access settings",
  "customer-history": "account history",
  jobs: "tickets",
  job: "the ticket",
  network: "the network list",
  recipes: "recipes",
  directory: "the directory",
  activity: "activity",
  deals: "deals",
  pms: "PMs",
  pm: "the PM",
  handoff: "the handoff list",
  comments: "comments",
  notifications: "notifications",
  rebuilds: "rebuilds",
  modules: "modules",
  "pm-runbook": "the PM runbook",
  "pm-bill": "the PM bill",
  charges: "charges",
  invoice: "the invoice",
  roster: "the roster",
  inspection: "the pre-inspection",
  "account-equipment": "account equipment",
  parts: "parts",
  "billing-items": "the parts list",
  analytics: "analytics",
  planner: "the planner",
  "runbook-readiness": "runbook readiness",
  "library-files": "the Library",
  "clean-names": "clean names",
  "address-report": "the address report",
};

/** A plain name for a query ("installs", "PMs") from its key; unknown keys read as their words ("spec reads"). */
export function nounForQueryKey(key: readonly unknown[]): string {
  const head = typeof key[0] === "string" ? key[0] : "";
  return NOUNS[head] ?? (head.replace(/[-_]+/g, " ").trim() || "this page's data");
}

/** A count to show: the number once its list has loaded, "—" while loading or after a failed load (never a fake 0). */
export function shownCount(loaded: boolean, n: number): number | string {
  return loaded ? n : "—";
}

/** The text "Copy error" puts on the clipboard: enough for Claude or Grok to find the cause. */
export function loadProblemReport(page: string, problems: { noun: string; message: string }[], when: string): string {
  return [`Katz Desk load problem · ${when}`, `Page: ${page}`, ...problems.map((p) => `Couldn't load ${p.noun}: ${p.message}`)].join("\n");
}

/**
 * What a list's empty spot says before its data has loaded: "Loading tickets…", or after a failed load "The tickets
 * list didn't load. See the message above." Null once it loaded, so the page's own "No … yet" shows only then.
 */
export function notLoadedText(query: { isSuccess: boolean; isError: boolean }, noun: string): string | null {
  if (query.isSuccess) return null;
  return query.isError ? `The ${noun} list didn't load. See the message above.` : `Loading ${noun}…`;
}
