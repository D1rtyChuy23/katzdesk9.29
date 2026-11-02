/**
 * Exact text for the Teams group chats and DMs Katz uses.
 * Pure: no network. Nothing here posts. A note is sent only after this exact text is approved.
 */
import { canonicalRepName } from "./rep-match.ts";
import { canonicalTechName } from "./tech-match.ts";
import { OTHER_MAKER, pulledLabel, weekDayLabel } from "./po-report.ts";
import type { GetReadyLine } from "./get-ready.ts";

const MAX_LINES = 8;
const MAX_CHARS = 160;
/** The get-ready list is what the techs pull, so it shows more than a usual section. */
const MAX_GET_READY_LINES = 30;
/** A rep's sections list what is still pending, so they show more than a usual section. */
const MAX_REP_LINES = 15;
/** An install's needs and a get-ready line name machines, so they may run longer before they are cut. */
const MAX_LONG_CHARS = 320;
/** The weekly Purchase Order report lists every part used; this keeps the note well under what an approval takes. */
const PO_TEXT_BUDGET = 18_000;

/** What a chat's note lists. `target` names the rep, region (dfw | sa-atx | other) or tech for those feeds. "none" has no automatic note. */
export const TEAMS_FEEDS = ["service", "orders", "rep", "region", "leadership", "tech", "none"] as const;
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
  { id: "purchase-orders", name: "Purchase Order Requests", group: "Orders", kind: "group", about: "Each week's parts and water filters used, by manufacturer, to reorder in NetSuite.", feed: "orders", target: null },
  { id: "rep-sean", name: "Sean's Customers' Request", group: "Reps", kind: "group", about: "Sean Marshall's accounts: service done, open calls, the Pipeline and installs.", feed: "rep", target: "Sean Marshall" },
  { id: "rep-shannon", name: "Shannon's Customers' Request", group: "Reps", kind: "group", about: "Shannon Cafourek's accounts: service done, open calls, the Pipeline and installs.", feed: "rep", target: "Shannon Cafourek" },
  { id: "rep-amanda", name: "Amanda's Customers' Request", group: "Reps", kind: "group", about: "Amanda Logg's accounts: service done, open calls, the Pipeline and installs.", feed: "rep", target: "Amanda Logg" },
  { id: "rep-liz", name: "Liz's Customers' Request", group: "Reps", kind: "group", about: "Lizbeth Romero's accounts: service done, open calls, the Pipeline and installs.", feed: "rep", target: "Lizbeth Romero" },
  { id: "rep-chelsea", name: "Chelsea's Customers' Request", group: "Reps", kind: "group", about: "Chelsea's accounts: service done, open calls, the Pipeline and installs.", feed: "rep", target: "Chelsea" },
  { id: "rep-iliana", name: "Iliana's Customers' Request", group: "Reps", kind: "group", about: "Iliana's accounts: service done, open calls, the Pipeline and installs.", feed: "rep", target: "Iliana" },
  { id: "dfw", name: "DFW Service Chat", group: "Regions", kind: "group", about: "Dallas and Fort Worth service with Bill and Shannon.", feed: "region", target: "dfw" },
  { id: "sa-atx", name: "SA/ATX", group: "Regions", kind: "group", about: "San Antonio and Austin service.", feed: "region", target: "sa-atx" },
  { id: "service-monkeys", name: "Service Monkeys", group: "Regions", kind: "group", about: "Each tech's open calls, the calls outside DFW and SA/ATX that need a tech, and the equipment to get ready for installs.", feed: "region", target: "other" },
  { id: "k-team", name: "The K Team", group: "Leadership", kind: "group", about: "This month's counts and the parts-profit total.", feed: "leadership", target: null },
  // The techs are all in Service Monkeys (Chuy, 11/2): he removes these five DMs with Remove on the Teams page. They
  // stay here because this list is the seed's, for a database with no chats yet.
  { id: "dm-ryan", name: "Ryan Gloria", group: "Techs", kind: "dm", about: "Ryan's open calls.", feed: "tech", target: "Ryan Gloria" },
  { id: "dm-josh", name: "Josh", group: "Techs", kind: "dm", about: "Josh's open calls.", feed: "tech", target: "Joshua Harper" },
  { id: "dm-lance", name: "Lance Oden", group: "Techs", kind: "dm", about: "Lance's open calls.", feed: "tech", target: "Lance Oden" },
  { id: "dm-oliver", name: "Oliver Garcia", group: "Techs", kind: "dm", about: "Oliver's open calls.", feed: "tech", target: "Oliver Garcia" },
  { id: "dm-charles", name: "Charles Foster", group: "Techs", kind: "dm", about: "Charles's open calls.", feed: "tech", target: "Charles Foster" },
  // Corey dispatches drivers; he is not a tech and gets no automatic note. The id stays so his approval history stays linked.
  { id: "dm-cory", name: "Corey Russell", group: "Dispatch", kind: "dm", about: "Driver Dispatcher and Vehicle Maintenance", feed: "none", target: null },
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

/** Same rules the built-in rep chats always used: Corrigo/rep-list name, or first name (Liz is Lizbeth, on either side). */
function repMatches(rep: string, target: string): boolean {
  const raw = rep.trim();
  const want = target.trim();
  if (!raw || !want) return false;
  const first = (s: string) => (firstName(s) === "liz" ? "lizbeth" : firstName(s));
  return canonicalRepName(raw) === (canonicalRepName(want) ?? want) || first(raw) === first(want);
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

/** One part on the weekly Purchase Order report: its pieces new since the last report (below 0: taken off since). */
export type PoPart = { maker: string; sku: string; label: string; pieces: number };
/** The week the report covers (Saturday to Friday), when it was pulled, and its parts. */
export type PoReport = { from: string; to: string; pulledAt: string; parts: PoPart[] };

/** A service call or PM finished on an account. */
export type ServicedLine = {
  customer: string;
  rep: string;
  /** "Service call", "Phone Resolved" or "PM". */
  kind: string;
  date: string;
  ref: string;
  tech: string;
  /** The work done, else the issue. */
  what: string;
};

/** The Pipeline's own stages for an open deal. */
export type DealStage = "Ordered" | "Good to order" | "Needs good to order";
export type PipelineDeal = { customer: string; rep: string; equipment: string; stage: DealStage; eta: string };

/** An install still open on the Board, with what it still needs. */
export type OpenInstall = {
  customer: string;
  rep: string;
  date: string;
  machines: number;
  /** Machines missing power notes (volts or plug). */
  power: string[];
  /** Machines that take water, missing water notes. */
  water: string[];
  /** Pre-inspection pictures still needed, and on which machines (none named when the visit has no units yet). */
  pictures: { needed: boolean; machines: string[] };
};

export type TeamsSnapshot = {
  when: string;
  attention: AttentionLine[];
  duplicateWo: DuplicateWo[];
  calls: OpenCall[];
  kpiScope: string;
  kpi: AnalyticsCount[];
  finance: { scope: string; sell: string; cost: string; margin: string } | null;
  /** The weekly Purchase Order report (11/2). */
  po?: PoReport;
  /** Calls and PMs finished since the earliest day a rep chat's Serviced list starts. */
  serviced?: ServicedLine[];
  /** Each rep chat's first Serviced day: the day of its last note before today. */
  servicedFrom?: Record<string, string>;
  /** The first Serviced day for a rep chat with no earlier note: a week back. */
  servicedDefault?: string;
  deals?: PipelineDeal[];
  installs?: OpenInstall[];
  /** Machines on the installs this week and next, and what to pull for each. */
  getReady?: GetReadyLine[];
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

function section(heading: string, lines: string[], empty: string, max = MAX_LINES, chars = MAX_CHARS): string {
  const shown = lines.map((line) => clipLine(line, chars)).filter(Boolean);
  const kept = shown.slice(0, max);
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

/** ISO days or times in order, blanks last. */
const blankLast = (a: string, b: string) => (a === b ? 0 : !a ? 1 : !b ? -1 : a < b ? -1 : 1);

/** A tech by the roster name when there is one ("Josh" is Joshua Harper), else as typed. */
const techName = (raw: string) => canonicalTechName(raw) ?? raw.trim();
/** A call's techs by name, each once. */
const techList = (c: OpenCall) => [...new Set([c.tech, c.tech2].filter((t) => t.trim()).map(techName))];
/** "Ryan Gloria & Joshua Harper". */
const techsOf = (c: OpenCall) => techList(c).join(" & ");

const REGION_TAG: Record<ServiceRegion, string> = { dfw: "DFW", "sa-atx": "SA/ATX", other: "" };

const pieces = (n: number) => String(Math.round(n * 100) / 100);
const plural = (n: number, one: string, many: string) => `${pieces(n)} ${n === 1 ? one : many}`;

/** "Linea PB, Mythos One": each machine named once. */
const machineNames = (list: string[]) => [...new Set(list.map((m) => m.trim()).filter(Boolean))].join(", ");

/**
 * The weekly Purchase Order report as pulled: one block per manufacturer, most pieces first and Other last, each part
 * with the pieces new since the last report; then any pieces taken off tickets since an earlier report. Every part is
 * listed; only a week far past any real one would be cut short, and it says so.
 */
function poText(po: PoReport | undefined): string {
  const intro = po
    ? `Parts and water filters used, by manufacturer, in the week ${weekDayLabel(po.from)} to ${weekDayLabel(po.to)}, and any used earlier but entered since the last report. Pulled ${pulledLabel(po.pulledAt)} for Monday morning. Place the orders in NetSuite.`
    : "Parts and water filters used last week, by manufacturer.";
  const parts = po?.parts ?? [];
  const used = parts.filter((p) => p.pieces > 0);
  const off = parts.filter((p) => p.pieces < 0).sort((a, b) => a.sku.localeCompare(b.sku) || a.label.localeCompare(b.label));
  if (!used.length && !off.length) return `${intro}\n\nNone used that week.`;
  const makers = new Map<string, PoPart[]>();
  for (const p of used) makers.set(p.maker, [...(makers.get(p.maker) ?? []), p]);
  const total = (list: PoPart[]) => list.reduce((n, p) => n + p.pieces, 0);
  const blocks = [...makers.entries()]
    .map(([maker, list]) => ({
      head: maker,
      pieces: total(list),
      other: maker === OTHER_MAKER,
      list: [...list].sort((a, b) => b.pieces - a.pieces || a.sku.localeCompare(b.sku) || a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => Number(a.other) - Number(b.other) || b.pieces - a.pieces || a.head.localeCompare(b.head));
  const partLine = (p: PoPart) => `- ${clipLine(`${p.sku || "No SKU"}${p.label ? ` · ${p.label}` : ""} · ${pieces(p.pieces)}`)}`;
  const sections = blocks.map((b) => ({ head: `${b.head} · ${plural(b.list.length, "part", "parts")}, ${plural(b.pieces, "piece", "pieces")}`, list: b.list }));
  if (off.length) sections.push({ head: "Taken off tickets after an earlier report", list: off });
  let size = intro.length;
  let left = parts.length;
  const out: string[] = [intro];
  for (const sec of sections) {
    const lines: string[] = [];
    for (const p of sec.list) {
      const line = partLine(p);
      if (size + sec.head.length + line.length + 4 > PO_TEXT_BUDGET) break;
      lines.push(line);
      size += line.length + 1;
    }
    if (!lines.length) break;
    out.push([sec.head, ...lines].join("\n"));
    size += sec.head.length + 2;
    left -= lines.length;
    if (lines.length < sec.list.length) break;
  }
  if (left > 0) out.push(`And ${left} more ${left === 1 ? "part" : "parts"}.`);
  return out.join("\n\n");
}

function servicedLine(s: ServicedLine): string {
  return `${s.customer || "No account"} · ${s.date} · ${s.kind} · ${s.ref || "No number"}${s.tech ? ` · ${s.tech}` : ""}${s.what ? ` · ${s.what}` : ""}`;
}

function dealLine(d: PipelineDeal): string {
  return `${d.customer || "No account"} · ${d.equipment || "No equipment listed"} · ${d.stage}${d.stage === "Ordered" && d.eta ? ` · ETA ${d.eta}` : ""}`;
}

/** What an open install still needs: power notes, water notes, pre-inspection pictures. */
function installLine(i: OpenInstall): string {
  const needs: string[] = [];
  if (!i.machines) needs.push("No equipment listed");
  if (i.power.length) needs.push(`Missing power notes (${machineNames(i.power)})`);
  if (i.water.length) needs.push(`Missing water notes (${machineNames(i.water)})`);
  if (i.pictures.needed) needs.push(`Needs pre-inspection pictures${i.pictures.machines.length ? ` (${machineNames(i.pictures.machines)})` : ""}`);
  return `${i.customer || "No account"} · ${i.date || "No install date"} · ${needs.length ? needs.join(" · ") : "Power and water notes and pictures are in"}`;
}

function getReadyLine(g: GetReadyLine): string {
  const head = `${g.date}${g.time ? ` ${g.time}` : ""} · ${g.customer || "No account"} · ${g.model}${g.serial ? ` · SN ${g.serial}` : ""}`;
  const test = g.needsTest ? " · needs shop test" : "";
  if (g.state === "pulled") return `${head} · pulled${g.where ? ` from ${g.where}` : ""}${test}`;
  if (g.state === "to-pull") {
    const unit = g.unitSerial && !g.serial ? ` (SN ${g.unitSerial})` : "";
    const more = g.more ? ` · ${g.more} more in stock` : "";
    return `${head} · to pull from ${g.where || "the barn"}${unit}${more}${test}`;
  }
  return `${head} · none in stock`;
}

/** A region's calls: who has each one so far (with each tech's count), then the ones with no tech yet. */
function regionSections(calls: OpenCall[]): string[] {
  const assigned = calls
    .filter((c) => techsOf(c))
    .sort((a, b) => techsOf(a).localeCompare(techsOf(b)) || blankLast(a.when, b.when) || a.customer.localeCompare(b.customer));
  const counts = new Map<string, number>();
  for (const c of assigned) for (const t of techList(c)) counts.set(t, (counts.get(t) ?? 0) + 1);
  const tally = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t, n]) => `${t} ${n}`)
    .join(", ");
  return [
    section(`Assigned so far${tally ? ` (${tally})` : ""}`, assigned.map((c) => `${techsOf(c)} · ${callLine(c)}`), "None."),
    section("No tech yet", calls.filter((c) => !techsOf(c)).map(callLine), "None."),
  ];
}

/**
 * The techs are all in Service Monkeys (Chuy, 11/2), so it lists what each one has assigned so far, in every region,
 * as their own DMs did: one section per tech, a call with two techs under both.
 */
function techSections(calls: OpenCall[]): string[] {
  const byTech = new Map<string, OpenCall[]>();
  for (const c of calls) for (const t of techList(c)) byTech.set(t, [...(byTech.get(t) ?? []), c]);
  const tagged = (c: OpenCall) => `${callLine(c)}${REGION_TAG[c.region] ? ` · ${REGION_TAG[c.region]}` : ""}`;
  const sections = [...byTech.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tech, list]) => section(`${tech} · ${list.length} open ${list.length === 1 ? "call" : "calls"}`, list.map(tagged), "None."));
  return sections.length ? sections : [section("Assigned so far", [], "None.")];
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
    text = poText(snap.po);
  } else if (chat.feed === "rep") {
    const mine = <T extends { rep: string }>(rows: T[] | undefined) => (rows ?? []).filter((r) => repMatches(r.rep, target));
    const since = snap.servicedFrom?.[chat.id] ?? snap.servicedDefault ?? "";
    const serviced = mine(snap.serviced)
      .filter((s) => !since || s.date >= since)
      .sort((a, b) => b.date.localeCompare(a.date) || a.customer.localeCompare(b.customer) || a.ref.localeCompare(b.ref));
    text = [
      "Your accounts: the service we did, open calls, the Pipeline and installs.",
      section(since ? `Serviced since ${weekDayLabel(since)}` : "Serviced", serviced.map(servicedLine), "None.", MAX_REP_LINES),
      section("Open service calls", mine(snap.calls).map(callLine), "None.", MAX_REP_LINES),
      section("Pipeline", mine(snap.deals).map(dealLine), "None open.", MAX_REP_LINES),
      section("Installs", mine(snap.installs).map(installLine), "None open.", MAX_REP_LINES, MAX_LONG_CHARS),
    ].join("\n\n");
  } else if (chat.feed === "region" && target !== "other") {
    const mine = snap.calls.filter((c) => c.region === target);
    text = ["Open service calls in this region, and who has them.", ...regionSections(mine)].join("\n\n");
  } else if (chat.feed === "region") {
    text = [
      "Each tech's open calls, the calls outside Dallas–Fort Worth and San Antonio–Austin that still need a tech, and the equipment to get ready for installs this week and next.",
      ...techSections(snap.calls),
      section("No tech yet", snap.calls.filter((c) => c.region === "other" && !techsOf(c)).map(callLine), "None."),
      section("Get ready: installs this week and next", (snap.getReady ?? []).map(getReadyLine), "No installs this week or next.", MAX_GET_READY_LINES, MAX_LONG_CHARS),
    ].join("\n\n");
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
  } else if (chat.feed === "tech") {
    const mine = snap.calls.filter((c) => techMatches(c.tech, target) || techMatches(c.tech2, target));
    text = [`Your open calls.`, section("Calls", mine.map(callLine), "None.")].join("\n\n");
  }
  // A "none" chat has no automatic note, so `text` stays empty and there is nothing to approve.
  // `text` is the approved body. The clock stamp stays on `title` so a later minute does not expire the approval.
  return { id: chat.id, name: chat.name, group: chat.group, kind: chat.kind, about: chat.about, title, text };
}

export function draftAll(snap: TeamsSnapshot, chats: TeamsChat[] = TEAMS_CHATS): TeamsDraft[] {
  return chats.map((chat) => draftTeamsChat(chat, snap));
}
