/**
 * Plain-text notes for Teams channels. Pure: no network, no secrets.
 * Short lines, no markdown tables, same idea as a Library spec copy.
 *
 * Each channel is an incoming webhook set on the server, never in the repo:
 *   TEAMS_WEBHOOK_DISPATCH
 *   TEAMS_WEBHOOK_PARTS
 *   TEAMS_WEBHOOK_HANDOFF
 *   TEAMS_WEBHOOK_ANALYTICS
 * The payload is a Workflows Adaptive Card (`type: message` + attachment).
 */

export const TEAMS_CHANNELS = ["dispatch", "parts", "handoff", "analytics"] as const;
export type TeamsChannel = (typeof TEAMS_CHANNELS)[number];

export const TEAMS_CHANNEL_LABEL: Record<TeamsChannel, string> = {
  dispatch: "Dispatch",
  parts: "Parts",
  handoff: "Handoff",
  analytics: "Analytics",
};

export const TEAMS_WEBHOOK_ENV: Record<TeamsChannel, string> = {
  dispatch: "TEAMS_WEBHOOK_DISPATCH",
  parts: "TEAMS_WEBHOOK_PARTS",
  handoff: "TEAMS_WEBHOOK_HANDOFF",
  analytics: "TEAMS_WEBHOOK_ANALYTICS",
};

const MAX_LINES = 8;
const MAX_CHARS = 160;
const FOOTER = "KatzDesk keeps the record. This note is the exception list only.";

export type TeamsSection = { heading: string; lines: string[]; empty: string };

export type TeamsNote = {
  channel: TeamsChannel;
  title: string;
  text: string;
  lineCount: number;
};

export function clipLine(raw: string): string {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= MAX_CHARS) return s;
  return `${s.slice(0, MAX_CHARS - 1).trimEnd()}…`;
}

export function composeReport(input: {
  channel: TeamsChannel;
  title: string;
  intro: string;
  sections: TeamsSection[];
  footer?: string;
}): TeamsNote {
  const blocks = [input.intro.trim()];
  let lineCount = 0;
  for (const section of input.sections) {
    const lines = section.lines.map(clipLine).filter(Boolean);
    const shown = lines.slice(0, MAX_LINES);
    const more = lines.length - shown.length;
    lineCount += shown.length;
    const body = shown.length
      ? [...shown.map((line) => `- ${line}`), more > 0 ? `And ${more} more.` : ""].filter(Boolean).join("\n")
      : section.empty;
    blocks.push(`${section.heading}\n${body}`);
  }
  if (input.footer?.trim()) blocks.push(input.footer.trim());
  return { channel: input.channel, title: input.title.trim(), text: blocks.join("\n\n"), lineCount };
}

export type BlankWo = { board: string; id: number; customer: string; ref: string };
export type DuplicateWo = { wo: string; where: string };

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
export type NameWait = { katz: string; clean: string; reason: string };
export type AddressWait = { name: string; address: string; pin: string };
export type MissingMpn = { callId: string; customer: string; item: string };
export type ExcelBin = { sku: string; piece: string; value: string };
export type OpenAsk = { team: string; customer: string; body: string };
export type AnalyticsCount = { label: string; total: number; top: string };

export function dispatchReport(
  facts: { blankWo: BlankWo[]; duplicateWo: DuplicateWo[]; names: NameWait[]; addresses: AddressWait[] },
  when: string,
): TeamsNote {
  return composeReport({
    channel: "dispatch",
    title: `KatzDesk dispatch · ${when}`,
    intro: "Open work with no Corrigo number, the same number on two records, names waiting for approval, and accounts the map cannot place.",
    sections: [
      {
        heading: "No work order on an open record",
        lines: facts.blankWo.map((r) => `${r.board} #${r.id} · ${r.customer || "No account"}${r.ref ? ` · ${r.ref}` : ""}`),
        empty: "None.",
      },
      {
        heading: "Same work order on more than one open record",
        lines: facts.duplicateWo.map((r) => `WO ${r.wo} · ${r.where}`),
        empty: "None.",
      },
      {
        heading: "Customer names — Needs Approval",
        lines: facts.names.map((r) => `${r.katz || "No KatzDesk name"} → ${r.clean || "No clean-list name"}${r.reason ? ` · ${r.reason}` : ""}`),
        empty: "None.",
      },
      {
        heading: "Address report — the map cannot place the account",
        lines: facts.addresses.map((r) => {
          const pin = r.pin && !/\(zip area\)/i.test(r.pin) ? ` · pin ${r.pin}` : "";
          return `${r.name} · ${r.address || "No street address"}${pin}`;
        }),
        empty: "None.",
      },
    ],
    footer: `${FOOTER} Fix an address in NetSuite and re-import. A locked customer name is not renamed from here.`,
  });
}

export function partsReport(facts: { missingMpn: MissingMpn[]; excelDates: ExcelBin[] }, when: string): TeamsNote {
  return composeReport({
    channel: "parts",
    title: `KatzDesk parts · ${when}`,
    intro: "Ticket parts with no MPN, and bin locations that Excel stored as dates.",
    sections: [
      {
        heading: "Ticket parts with no MPN",
        lines: facts.missingMpn.map((r) => `${r.callId || "No call id"} · ${r.customer || "No account"} · ${r.item}`),
        empty: "None.",
      },
      {
        heading: "Bin locations that look like Excel dates",
        lines: facts.excelDates.map((r) => `${r.sku} · ${r.piece} ${r.value}`),
        empty: "None.",
      },
    ],
    footer: FOOTER,
  });
}

export function handoffReport(facts: { asks: OpenAsk[] }, when: string): TeamsNote {
  return composeReport({
    channel: "handoff",
    title: `KatzDesk handoff · ${when}`,
    intro: "Open asks. The note in KatzDesk is the record — this is only the ping.",
    sections: [
      {
        heading: "Open asks",
        lines: facts.asks.map((r) => `Ask ${r.team || "the team"} · ${r.customer || "No account"} · ${r.body}`),
        empty: "None.",
      },
    ],
    footer: FOOTER,
  });
}

export function analyticsReport(facts: { scope: string; counts: AnalyticsCount[] }, when: string): TeamsNote {
  return composeReport({
    channel: "analytics",
    title: `KatzDesk analytics · ${when}`,
    intro: facts.scope,
    sections: [
      {
        heading: "Counts",
        lines: facts.counts.map((r) => (r.top ? `${r.label} · ${r.total} · ${r.top}` : `${r.label} · ${r.total}`)),
        empty: "No records in this range.",
      },
    ],
    footer: "The full list stays in KatzDesk Analytics. Cost and margin are not in this note.",
  });
}

/** Body a Teams Workflow webhook accepts. The title is the card summary. */
export function adaptiveCardPayload(note: Pick<TeamsNote, "title" | "text">): {
  type: "message";
  attachments: { contentType: string; content: Record<string, unknown> }[];
} {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: note.title, weight: "Bolder", wrap: true, size: "Medium" },
            { type: "TextBlock", text: note.text, wrap: true },
          ],
        },
      },
    ],
  };
}
