import { CLOSED_CALL, CLOSED_PM } from "./lookups";

export function todayChicago(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(
    new Date(),
  );
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function diffDays(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function weekBounds(today: string): { start: string; end: string; nextStart: string; nextEnd: string } {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0 Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const start = addDays(today, mondayOffset);
  const end = addDays(start, 6);
  const nextStart = addDays(start, 7);
  const nextEnd = addDays(nextStart, 6);
  return { start, end, nextStart, nextEnd };
}

export function formatWeekLabel(start: string, end: string): string {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  const fmt = (dt: Date) =>
    `${dt.getMonth() + 1}/${dt.getDate()}`;
  return `${fmt(a)} – ${fmt(b)}`;
}

export type FlagLevel = "danger" | "warn" | "info";

export type ClockFlag = {
  code: string;
  label: string;
  level: FlagLevel;
  rank: number;
};

function closedCall(status: string | null | undefined, done: boolean): boolean {
  return done || CLOSED_CALL.has(status ?? "");
}

export function serviceFlag(input: {
  kind: "service" | "tlc";
  status: string;
  done: boolean;
  received: string | null;
  scheduled: string | null;
}, today: string): ClockFlag | null {
  if (closedCall(input.status, input.done)) return null;
  if (input.scheduled && input.scheduled < today) {
    return { code: "past_due", label: "Past due — scheduled", level: "danger", rank: 10 };
  }
  if (input.received) {
    const days = diffDays(input.received, today);
    if (input.kind === "tlc") {
      if (days >= 14) return { code: "open_2w", label: "Open past 2 weeks", level: "danger", rank: 20 };
      if (days >= 10) return { code: "open_10d", label: "Open 10–14 days", level: "warn", rank: 30 };
    } else {
      if (days >= 2) return { code: "open_48", label: "Open past 48 hrs", level: "danger", rank: 20 };
      if (days >= 1) return { code: "open_24", label: "Open 24–48 hrs", level: "warn", rank: 30 };
    }
  }
  return null;
}

export function pmFlag(input: {
  status: string;
  done: boolean;
  projected: string | null;
}, today: string): ClockFlag | null {
  if (input.done || CLOSED_PM.has(input.status)) return null;
  if (!input.projected) {
    return { code: "needs_date", label: "Needs PM date", level: "warn", rank: 15 };
  }
  const days = diffDays(today, input.projected);
  if (days < 0) {
    const overdue = -days;
    if (overdue >= 14) return { code: "pm_late_2w", label: "2+ weeks past projected", level: "danger", rank: 5 };
    return { code: "pm_overdue", label: "PM overdue", level: "danger", rank: 10 };
  }
  if (days <= 14) return { code: "pm_due", label: "PM due within 14 days", level: "warn", rank: 25 };
  return null;
}

export function installFlag(input: {
  equipStatus: string | null;
  installDate: string | null;
  reqsReady: string | null;
  complete: boolean;
}, today: string, week: ReturnType<typeof weekBounds>): ClockFlag | null {
  if (input.complete || input.equipStatus === "Installed") return null;
  const date = input.installDate;
  const inWindow =
    !!date && date >= week.start && date <= week.nextEnd;
  const past = !!date && date < today;
  if (input.equipStatus === "Not Ready" && past) {
    return { code: "past_not_ready", label: "Past due — not ready", level: "danger", rank: 8 };
  }
  if (input.equipStatus === "Not Ready" && inWindow) {
    return { code: "equip_not_ready", label: "Equipment not ready", level: "danger", rank: 12 };
  }
  if (input.reqsReady === "Not Ready" && inWindow && input.equipStatus !== "Not Ready") {
    return { code: "cust_not_ready", label: "Customer not ready", level: "warn", rank: 18 };
  }
  return null;
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${m}/${d}`;
}

export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const dt = new Date(`${iso}T12:00:00`);
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function money(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

export function moneyExact(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(v);
}
