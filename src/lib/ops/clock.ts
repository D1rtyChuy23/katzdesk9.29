import { isClosedCall, isClosedPm } from "./ticket-status";
import { isInstalled } from "./install-status";
import { diffDays } from "./iso";

export { isInstalled, isOpenInstall, installedPatch } from "./install-status";
export { diffDays } from "./iso";

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

export function monthBounds(iso: string): { start: string; end: string; year: number; month: number } {
  const [y, m] = iso.split("-").map(Number);
  const year = y || 1970;
  const month = m || 1;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end, year, month };
}

export function addMonths(iso: string, delta: number): string {
  const [y, m] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y || 1970, (m || 1) - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function formatMonthLabel(iso: string): string {
  const { year, month } = monthBounds(iso);
  const dt = new Date(Date.UTC(year, month - 1, 1));
  return dt.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatWeekLabel(start: string, end: string): string {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  const fmt = (dt: Date) =>
    `${dt.getMonth() + 1}/${dt.getDate()}`;
  return `${fmt(a)} – ${fmt(b)}`;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type FlagLevel = "danger" | "warn" | "info";

export type ClockFlag = {
  code: string;
  label: string;
  level: FlagLevel;
  rank: number;
};

export function serviceFlag(input: {
  kind: "service" | "tlc";
  status: string;
  done: boolean;
  received: string | null;
  scheduled: string | null;
}, today: string): ClockFlag | null {
  if (isClosedCall(input)) return null;
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
  if (isClosedPm(input)) return null;
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
  if (isInstalled(input)) return null;
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

export function formatPingTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (!Number.isFinite(dt.getTime())) return "";
  return dt.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

export function formatNowChicago(): { date: string; time: string; stamp: string } {
  const date = todayChicago();
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
  return { date, time, stamp: `${date} ${time} CT` };
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
