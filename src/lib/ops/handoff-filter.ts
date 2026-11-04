/**
 * The Handoff page's two views. Pure: no server imports, safe for node --test and the screens.
 */
import { namesMatchUser } from "./lookups";
import type { HandoffFeed } from "./types";

export type HandoffScope = "mine" | "all";

type HandoffUser = { id: string; displayName: string | null; primaryEmail: string | null } | null;

/**
 * All has everything. Mine has the asks and notes that belong to the person (theirs, or on jobs and accounts that are
 * theirs), the completed deals they produced, and, for an Admin, every deal link waiting for review (11/3). The links
 * wait for an Admin, so anyone else sees them under All only.
 */
export function filterHandoff(
  d: HandoffFeed | undefined,
  user: HandoffUser,
  username: string | null,
  scope: HandoffScope,
  reviewer: boolean,
): HandoffFeed {
  const empty: HandoffFeed = { asks: [], recent: [], pendingHandoffs: [], dealReviews: [] };
  if (!d) return empty;
  const reviews = d.dealReviews ?? [];
  if (scope === "all") return { ...d, dealReviews: reviews };
  const asUser = {
    displayName: [user?.displayName, username].filter(Boolean).join(" ") || user?.displayName || null,
    primaryEmail: user?.primaryEmail ?? null,
  };
  const mine = (c: {
    authorId: string | null;
    authorName: string | null;
    technician?: string | null;
    producer?: string | null;
    accountRep?: string | null;
  }) =>
    (!!user?.id && c.authorId === user.id) ||
    namesMatchUser(asUser, c.authorName, c.technician, c.producer, c.accountRep);
  return {
    pendingHandoffs: d.pendingHandoffs.filter((p) => namesMatchUser(asUser, p.producer)),
    dealReviews: reviewer ? reviews : [],
    asks: d.asks.filter((c) => mine(c)),
    recent: d.recent.filter((c) => mine(c)),
  };
}

/** The Mine button's count: what Mine lists, with a note that is also an open ask counted once. */
export function handoffMineCount(mine: HandoffFeed): number {
  const askIds = new Set(mine.asks.map((c) => c.id));
  return (
    mine.pendingHandoffs.length +
    mine.dealReviews.length +
    mine.asks.length +
    mine.recent.filter((c) => !askIds.has(c.id)).length
  );
}
