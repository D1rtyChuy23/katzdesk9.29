/**
 * Exact text for the Teams group chats and DMs Katz uses.
 * Pure: no network. Nothing here posts. A note is sent only after this exact text is approved.
 */
import { canonicalRepName } from "./rep-match.ts";
import { canonicalTechName } from "./tech-match.ts";

const MAX_LINES = 8;
const MAX_CHARS = 160;

/** What a chat's note lists. `target` names the rep, region (dfw | sa-atx | other) or tech for those feeds. */
export const TEAMS_FEEDS = ["service", "orders", "rep", "region", "leadership", "tech", "dispatch"] as const;
export type TeamsFeed = (typeof TEAMS_FEEDS)[number];

export type TeamsChat = {
  id: string;
  name: string;
  group: string;
  kind: "group" | "dm";
  about: string;
  feed: TeamsFeed;
  target: string | null;
};

/** The built-in chats, same as the teams_chats seed. Used when that table is empty. */
export const TEAMS_CHATS: TeamsChat[] = [
  { id: "big-tymers", name: "Big Tymers, Big Poppin", group: "Service", kind: "group", about: "Main service tracker. What needs attention.", feed: "service", target: null },
  { id: "purchase-orders", name: "Purchase Order Requests", group: "Orders", kind: "group", about: "Parts and water-filter orders to place in NetSuite.", feed: "orders", target: null },
  { id: "rep-sean", name: "Sean's Customers' Request", group: "Reps", kind: "group", about: "Sean Marshall's customer service calls.", feed: "rep", target: "Sean Marshall" },
  { id: "rep-shannon", name: "Shannon's Customers' Request", group: "Reps", kind: "group", about: "Shannon Cafourek's customer service calls.", feed: "rep", target: "Shannon Cafourek" },
  { id: "rep-amanda", name: "Amanda's Customers' Request", group: "Reps", kind: "group", about: "Amanda Logg's customer service calls.", feed: "rep", target: "Amanda Logg" },
  { id: "rep-liz", name: "Liz's Customers' Request", group: "Reps", kind: "group", about: "Lizbeth Romero's customer service calls.", feed: "rep", target: "Lizbeth Romero" },
  { id: "rep-chelsea", name: "Chelsea's Customers' Request", group: "Reps", kind: "group", about: "Chelsea's customer service calls.", feed: "rep", target: "Chelsea" },
  { id: "rep-iliana", name: "Iliana's Customers' Request", group: "Reps", kind: "group", about: "Iliana's customer service calls.", feed: "rep", target: "Iliana" },
  { id: "dfw", name: "DFW Service Chat", group: "Regions", kind: "group", about: "Dallas and Fort Worth service with Bill and Shannon.", feed: "region", target: "dfw" },
  { id: "sa-atx", name: "SA/ATX", group: "Regions", kind: "group", about: "San Antonio and Austin service.", feed: "region", target: "sa-atx" },
  { id: "service-monkeys", name: "Service Monkeys", group: "Regions", kind: "group", about: "Open calls outside DFW and SA/ATX that still need a tech.", feed: "region", target: "other" },
  { id: "k-team", name: "The K Team", group: "Leadership", kind: "group", about: "This month's counts and the parts-profit total.", feed: "leadership", target: null },
  { id: "dm-ryan", name: "Ryan Gloria", group: "Techs", kind: "dm", about: "Ryan's open calls.", feed: "tech", target: "Ryan Gloria" },
  { id: "dm-josh", name: "Josh", group: "Techs", kind: "dm", about: "Josh's open calls.", feed: "tech", target: "Joshua Harper" },
  { id: "dm-lance", name: "Lance Oden", group: "Techs", kind: "dm", about: "Lance's open calls.", feed: "tech", target: "Lance Oden" },
  { id: "dm-oliver", name: "Oliver Garcia", group: "Techs", kind: "dm", about: "Oliver's open calls.", feed: "tech", target: "Oliver Garcia" },
  { id: "dm-charles", name: "Charles Foster", group: "Techs", kind: "dm", about: "Charles's open calls.", feed: "tech", target: "Charles Foster" },
  // Corey is the delivery dispatcher, not a tech. The id stays so his approval history stays linked.
  { id: "dm-cory", name: "Corey Russell", group: "Dispatch", kind: "dm", about: "Installs still to deliver, by install date.", feed: "dispatch", target: null },
];

export function teamsChat(id: string): TeamsChat | null {
  return TEAMS_CHATS.find((c) => c.id === id) ?? null;
}

export function clipLine(raw: string, max = MAX_CHARS): string {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

export type TeamsDraft = {
  id: string;
  name: string;
  group: string;
  kind: "group" | "dm";
  about: string;
  title: string;
  text: string;
};

const DFW_CITY = /\b(dallas|fort worth|arlington|plano|irving|garland|frisco|mckinney|denton|richardson|grand prairie|carrollton|lewisville|allen|grapevine|mesquite|euless|bedford|hurst|southlake|flower mound|north richland hills|addison|farmers branch|coppell|the colony|little elm|rockwall|wylie|rowlett|de ?soto|duncanville|cedar hill|mansfield|keller|colleyville|haltom city)\b/i;
const SATX_CITY = /\b(san antonio|austin|round rock|cedar park|georgetown|pflugerville|new braunfels|schertz|kyle|buda|leander|san marcos)\b/i;

export type ServiceRegion = "dfw" | "sa-atx" | "other";

/** City first, then ZIP. A Houston street named Dallas does not use the ZIP rule once a city matched. */
export function serviceRegion(raw: string | null | undefined): ServiceRegion {
  const s = String(raw ?? "");
  if (DFW_CITY.test(s)) return "dfw";
  if (SATX_CITY.test(s)) return "sa-atx";
  const zips = s.match(/\b\d{5}(?:-\d{4})?\b/g) ?? [];
  for (const zip of zips) {
    const prefix = Number(zip.slice(0, 3));
    if ((prefix >= 750 && prefix <= 753) || (prefix >= 760 && prefix <= 762)) return "dfw";
    if (prefix === 780 || prefix === 781 || prefix === 782 || prefix === 786 || prefix === 787) return "sa-atx";
  }
  return "other";
}

function firstName(raw: string): string {
  return raw.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

/** Same rules the built-in rep chats always used: Corrigo/rep-list name, or first name (Liz is Lizbeth). */
function repMatches(rep: string, target: string): boolean {
  const raw = rep.trim();
  const want = target.trim();
  if (!raw || !want) return false;
  const first = firstName(raw) === "liz" ? "lizbeth" : firstName(raw);
  return canonicalRepName(raw) === (canonicalRepName(want) ?? want) || first === firstName(want);
}

/** A roster tech matches by roster name ("Josh" is Joshua Harper). Anyone else matches by first name. */
function techMatches(tech: string, target: string): boolean {
  const raw = tech.trim();
  const want = target.trim();
  if (!raw || !want) return false;
  const roster = canonicalTechName(want);
  if (roster) return canonicalTechName(raw) === roster;
  return firstName(raw) === firstName(want);
}

export function repChatId(rep: string | null | undefined, chats: TeamsChat[] = TEAMS_CHATS): string | null {
  return chats.find((c) => c.feed === "rep" && repMatches(rep ?? "", c.target ?? ""))?.id ?? null;
}

export function techChatId(tech: string | null | undefined, chats: TeamsChat[] = TEAMS_CHATS): string | null {
  return chats.find((c) => c.feed === "tech" && techMatches(tech ?? "", c.target ?? ""))?.id ?? null;
}

export type AttentionLine = { label: string; board: string; customer: string; tech: string; ref: string };
export type DuplicateWo = { wo: string; where: string };
export type OrderLine = { callId: string; customer: string; item: string; qty: string; water: boolean };
export type OpenCall = {
  customer: string;
  rep: string;
  tech: string;
  tech2: string;
  region: ServiceRegion;
  status: string;
  when: string;
  issue: string;
  ref: string;
};
export type AnalyticsCount = { label: string; total: number; top: string };
export type DeliveryLine = { date: string; customer: string; equipment: string; status: string };

export type TeamsSnapshot = {
  when: string;
  attention: AttentionLine[];
  duplicateWo: DuplicateWo[];
  orders: OrderLine[];
  calls: OpenCall[];
  /** Installs still to deliver, already in install-date order. */
  deliveries: DeliveryLine[];
  kpiScope: string;
  kpi: AnalyticsCount[];
  finance: { scope: string; sell: string; cost: string; margin: string } | null;
};

/** Rows that share a Corrigo match key become one line. A single record is not a duplicate. */
export function collapseDuplicateWorkOrders(rows: { key: string; wo: string; where: string }[]): DuplicateWo[] {
  const groups = new Map<string, { wo: string; where: string }[]>();
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push({ wo: row.wo.trim(), where: row.where });
    groups.set(key, list);
  }
  const out: DuplicateWo[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    out.push({ wo: group[0]!.wo, where: group.map((g) => g.where).join(", ") });
  }
  return out.sort((a, b) => a.wo.localeCompare(b.wo) || a.where.localeCompare(b.where));
}

function section(heading: string, lines: string[], empty: string): string {
  const shown = lines.map((line) => clipLine(line)).filter(Boolean);
  const kept = shown.slice(0, MAX_LINES);
  const more = shown.length - kept.length;
  const body = kept.length
    ? [...kept.map((line) => `- ${line}`), more > 0 ? `And ${more} more.` : ""].filter(Boolean).join("\n")
    : empty;
  return `${heading}\n${body}`;
}

function callLine(c: OpenCall): string {
  const when = c.when ? ` · ${c.when}` : "";
  const issue = c.issue ? ` · ${c.issue}` : "";
  return `${c.customer || "No account"} · ${c.status || "Open"}${when} · ${c.ref || "No number"}${issue}`;
}

function deliveryLine(d: DeliveryLine): string {
  return `${d.date || "No date"} · ${d.customer || "No account"} · ${clipLine(d.equipment, 40) || "No equipment"} · ${d.status || "Not Ready"}`;
}

export function draftTeamsChat(chat: TeamsChat, snap: TeamsSnapshot): TeamsDraft {
  const title = `${chat.name} · ${snap.when}`;
  const target = chat.target ?? "";
  let text = "";
  if (chat.feed === "service") {
    text = [
      "What needs attention.",
      section(
        "Clock",
        snap.attention.map((r) => `${r.label} · ${r.board} · ${r.customer || "No account"}${r.tech ? ` · ${r.tech}` : ""} · ${r.ref || "No number"}`),
        "None.",
      ),
      section(
        "Same work order on more than one open record",
        snap.duplicateWo.map((r) => `WO ${r.wo} · ${r.where}`),
        "None.",
      ),
    ].join("\n\n");
  } else if (chat.feed === "orders") {
    text = [
      "Parts and water filters on open tickets with no purchase order. Place these in NetSuite.",
      section(
        "To order",
        snap.orders.map((r) => `${r.water ? "Water filter" : "Part"} · ${r.callId || "No call id"} · ${r.customer || "No account"} · ${r.item} · qty ${r.qty || "1"}`),
        "None.",
      ),
    ].join("\n\n");
  } else if (chat.feed === "rep") {
    const mine = snap.calls.filter((c) => repMatches(c.rep, target));
    text = [`Open service calls on your accounts.`, section("Calls", mine.map(callLine), "None.")].join("\n\n");
  } else if (chat.feed === "region" && target !== "other") {
    const mine = snap.calls.filter((c) => c.region === target);
    text = [`Open service calls in this region.`, section("Calls", mine.map(callLine), "None.")].join("\n\n");
  } else if (chat.feed === "region") {
    const mine = snap.calls.filter((c) => c.region === "other" && !c.tech && !c.tech2);
    text = [`Open calls outside Dallas–Fort Worth and San Antonio–Austin that have no tech yet.`, section("Needs a tech", mine.map(callLine), "None.")].join("\n\n");
  } else if (chat.feed === "leadership") {
    const finance = snap.finance
      ? section("Parts profit", [`Sell ${snap.finance.sell} · cost ${snap.finance.cost} · margin ${snap.finance.margin}`, snap.finance.scope], "None.")
      : section("Parts profit", [], "Not included.");
    text = [
      snap.kpiScope,
      section(
        "Counts",
        snap.kpi.map((r) => (r.top ? `${r.label} · ${r.total} · ${r.top}` : `${r.label} · ${r.total}`)),
        "No records this month.",
      ),
      finance,
    ].join("\n\n");
  } else if (chat.feed === "dispatch") {
    text = ["Installs still to deliver, by install date.", section("To deliver", snap.deliveries.map(deliveryLine), "None.")].join("\n\n");
  } else {
    const mine = snap.calls.filter((c) => techMatches(c.tech, target) || techMatches(c.tech2, target));
    text = [`Your open calls.`, section("Calls", mine.map(callLine), "None.")].join("\n\n");
  }
  // `text` is the approved body. The clock stamp stays on `title` so a later minute does not expire the approval.
  return { id: chat.id, name: chat.name, group: chat.group, kind: chat.kind, about: chat.about, title, text };
}

export function draftAll(snap: TeamsSnapshot, chats: TeamsChat[] = TEAMS_CHATS): TeamsDraft[] {
  return chats.map((chat) => draftTeamsChat(chat, snap));
}
