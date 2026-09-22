import { PRODUCER_INITIALS } from "./lookups";
import type { Comment, HandoffOwners } from "./types";

const INITIALS_TO_PRODUCER = Object.fromEntries(
  Object.entries(PRODUCER_INITIALS).map(([name, initials]) => [initials.toLowerCase(), name]),
);

export function salesName(owners?: HandoffOwners | null): string | null {
  if (!owners) return null;
  const producer = owners.producer?.trim();
  if (producer) return producer;
  const rep = owners.accountRep?.trim();
  if (!rep) return null;
  const fromInitials = INITIALS_TO_PRODUCER[rep.toLowerCase()];
  return fromInitials ? `${fromInitials} (${rep})` : rep;
}

export function noteOwner(
  c: Pick<Comment, "authorId" | "authorName" | "entityType" | "askTeam">,
  owners?: HandoffOwners | null,
): { label: string; canClaim: boolean; kind: "user" | "sales" | "service" | "unclaimed" } {
  if (c.authorId) {
    return { label: c.authorName?.trim() || "Teammate", canClaim: false, kind: "user" };
  }
  const sales = salesName(owners);
  if (c.entityType === "deal" && sales) {
    return { label: sales, canClaim: true, kind: "sales" };
  }
  const serviceSide =
    c.entityType === "service" ||
    c.entityType === "tlc" ||
    c.entityType === "pm" ||
    c.entityType === "install" ||
    c.askTeam === "service";
  if (serviceSide) {
    return { label: "Service", canClaim: true, kind: "service" };
  }
  if (sales) {
    return { label: sales, canClaim: true, kind: "sales" };
  }
  return { label: "Unclaimed", canClaim: true, kind: "unclaimed" };
}
