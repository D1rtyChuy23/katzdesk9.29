/**
 * Exact text for the Teams group chats and DMs Katz uses.
 * Pure: no network. Nothing here posts. A note is sent only after this exact text is approved.
 */
import { canonicalRepName } from "./rep-match.ts";
import { canonicalTechName } from "./tech-match.ts";

const MAX_LINES = 8;
const MAX_CHARS = 160;

export const TEAMS_CHAT_IDS = [
  "big-tymers",
  "purchase-orders",
  "rep-sean",
  "rep-shannon",
  "rep-amanda",
  "rep-liz",
  "rep-chelsea",
  "rep-iliana",
  "dfw",
  "sa-atx",
  "service-monkeys",
  "k-team",
  "dm-ryan",
  "dm-josh",
  "dm-lance",
  "dm-oliver",
  "dm-charles",
  "dm-cory",
] as const;
export type TeamsChatId = (typeof TEAMS_CHAT_IDS)[number];

export type TeamsChatGroup = "Service" | "Orders" | "Reps" | "Regions" | "Leadership" | "Techs";

export type TeamsChat = {
  id: TeamsChatId;
  name: string;
  group: TeamsChatGroup;
  kind: "group" | "dm";
  about: string;
};

export const TEAMS_CHATS: TeamsChat[] = [
  { id: "big-tymers", name: "Big Tymers, Big Poppin", group: "Service", kind: "group", about: "Main service tracker. What needs attention." },
  { id: "purchase-orders", name: "Purchase Order Requests", group: "Orders", kind: "group", about: "Parts and water-filter orders to place in NetSuite." },
  { id: "rep-sean", name: "Sean's Customers' Request", group: "Reps", kind: "group", about: "Sean Marshall's customer service calls." },
  { id: "rep-shannon", name: "Shannon's Customers' Request", group: "Reps", kind: "group", about: "Shannon Cafourek's customer service calls." },
  { id: "rep-amanda", name: "Amanda's Customers' Request", group: "Reps", kind: "group", about: "Amanda Logg's customer service calls." },
  { id: "rep-liz", name: "Liz's Customers' Request", group: "Reps", kind: "group", about: "Lizbeth Romero's customer service calls." },
  { id: "rep-chelsea", name: "Chelsea's Customers' Request", group: "Reps", kind: "group", about: "Chelsea's customer service calls." },
  { id: "rep-iliana", name: "Iliana's Customers' Request", group: "Reps", kind: "group", about: "Iliana's customer service calls." },
  { id: "dfw", name: "DFW Service Chat", group: "Regions", kind: "group", about: "Dallas and Fort Worth service with Bill and Shannon." },
  { id: "sa-atx", name: "SA/ATX", group: "Regions", kind: "group", about: "San Antonio and Austin service." },
  { id: "service-monkeys", name: "Service Monkeys", group: "Regions", kind: "group", about: "Open calls outside DFW and SA/ATX that still need a tech." },
  { id: "k-team", name: "The K Team", group: "Leadership", kind: "group", about: "This month's counts and the parts-profit total." },
  { id: "dm-ryan", name: "Ryan Gloria", group: "Techs", kind: "dm", about: "Ryan's open calls." },
  { id: "dm-josh", name: "Josh", group: "Techs", kind: "dm", about: "Josh's open calls." },
  { id: "dm-lance", name: "Lance Oden", group: "Techs", kind: "dm", about: "Lance's open calls." },
  { id: "dm-oliver", name: "Oliver Garcia", group: "Techs", kind: "dm", about: "Oliver's open calls." },
  { id: "dm-charles", name: "Charles Foster", group: "Techs", kind: "dm", about: "Charles's open calls." },
  { id: "dm-cory", name: "Cory Russell", group: "Techs", kind: "dm", about: "Cory's open calls." },
];

export function teamsChat(id: string): TeamsChat | null {
  return TEAMS_CHATS.find((c) => c.id === id) ?? null;
}

export function clipLine(raw: string): string {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= MAX_CHARS) return s;
  return `${s.slice(0, MAX_CHARS - 1).trimEnd()}…`;
}

export type TeamsDraft = {
  id: TeamsChatId;
  name: string;
  group: TeamsChatGroup;
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

const REP_CHAT: { id: TeamsChatId; test: (rep: string) => boolean }[] = [
  { id: "rep-sean", test: (rep) => canonicalRepName(rep) === "Sean Marshall" || firstName(rep) === "sean" },
  { id: "rep-shannon", test: (rep) => canonicalRepName(rep) === "Shannon Cafourek" || firstName(rep) === "shannon" },
  { id: "rep-amanda", test: (rep) => canonicalRepName(rep) === "Amanda Logg" || firstName(rep) === "amanda" },
  { id: "rep-liz", test: (rep) => canonicalRepName(rep) === "Lizbeth Romero" || firstName(rep) === "liz" || firstName(rep) === "lizbeth" },
  { id: "rep-chelsea", test: (rep) => firstName(rep) === "chelsea" },
  { id: "rep-iliana", test: (rep) => firstName(rep) === "iliana" },
];

export function repChatId(rep: string | null | undefined): TeamsChatId | null {
  const raw = (rep ?? "").trim();
  if (!raw) return null;
  return REP_CHAT.find((c) => c.test(raw))?.id ?? null;
}

const TECH_CHAT: { id: TeamsChatId; name: string }[] = [
  { id: "dm-ryan", name: "Ryan Gloria" },
  { id: "dm-josh", name: "Joshua Harper" },
  { id: "dm-lance", name: "Lance Oden" },
  { id: "dm-oliver", name: "Oliver Garcia" },
  { id: "dm-charles", name: "Charles Foster" },
  { id: "dm-cory", name: "Cory Russell" },
];

export function techChatId(tech: string | null | undefined): TeamsChatId | null {
  const raw = (tech ?? "").trim();
  if (!raw) return null;
  const canonical = canonicalTechName(raw);
  if (canonical) {
    const hit = TECH_CHAT.find((t) => t.name === canonical);
    if (hit) return hit.id;
  }
  if (firstName(raw) === "cory" || /\bcory russell\b/i.test(raw)) return "dm-cory";
  return null;
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

export type TeamsSnapshot = {
  when: string;
  attention: AttentionLine[];
  duplicateWo: DuplicateWo[];
  orders: OrderLine[];
  calls: OpenCall[];
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
  const shown = lines.map(clipLine).filter(Boolean);
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

function jobsForTech(calls: OpenCall[], id: TeamsChatId): OpenCall[] {
  return calls.filter((c) => techChatId(c.tech) === id || techChatId(c.tech2) === id);
}

export function draftTeamsChat(id: TeamsChatId, snap: TeamsSnapshot): TeamsDraft {
  const chat = teamsChat(id)!;
  const title = `${chat.name} · ${snap.when}`;
  let text = "";
  if (id === "big-tymers") {
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
  } else if (id === "purchase-orders") {
    text = [
      "Parts and water filters on open tickets with no purchase order. Place these in NetSuite.",
      section(
        "To order",
        snap.orders.map((r) => `${r.water ? "Water filter" : "Part"} · ${r.callId || "No call id"} · ${r.customer || "No account"} · ${r.item} · qty ${r.qty || "1"}`),
        "None.",
      ),
    ].join("\n\n");
  } else if (id.startsWith("rep-")) {
    const mine = snap.calls.filter((c) => repChatId(c.rep) === id);
    text = [`Open service calls on your accounts.`, section("Calls", mine.map(callLine), "None.")].join("\n\n");
  } else if (id === "dfw" || id === "sa-atx") {
    const region = id === "dfw" ? "dfw" : "sa-atx";
    const mine = snap.calls.filter((c) => c.region === region);
    text = [`Open service calls in this region.`, section("Calls", mine.map(callLine), "None.")].join("\n\n");
  } else if (id === "service-monkeys") {
    const mine = snap.calls.filter((c) => c.region === "other" && !c.tech && !c.tech2);
    text = [`Open calls outside Dallas–Fort Worth and San Antonio–Austin that have no tech yet.`, section("Needs a tech", mine.map(callLine), "None.")].join("\n\n");
  } else if (id === "k-team") {
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
  } else {
    const mine = jobsForTech(snap.calls, id);
    text = [`Your open calls.`, section("Calls", mine.map(callLine), "None.")].join("\n\n");
  }
  // `text` is the approved body. The clock stamp stays on `title` so a later minute does not expire the approval.
  return { id: chat.id, name: chat.name, group: chat.group, kind: chat.kind, about: chat.about, title, text };
}

export function draftAll(snap: TeamsSnapshot): TeamsDraft[] {
  return TEAMS_CHAT_IDS.map((id) => draftTeamsChat(id, snap));
}
