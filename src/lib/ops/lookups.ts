export const TECHNICIANS = [
  "Ryan",
  "Elias",
  "Oliver",
  "Josh",
  "Charles",
  "Bill",
  "Lance",
  "3rd Party",
] as const;

export const CALL_STATUSES = [
  "Open",
  "Dispatched",
  "In Progress",
  "Follow-up Needed",
  "Phone Resolved",
  "Completed",
  "Cancelled",
] as const;

export const CALL_TYPES = ["Field Service", "In-House Rebuild", "Installation"] as const;

export const PM_STATUSES = [
  "Pending Scheduling",
  "Scheduled",
  "Awaiting Parts",
  "Ready to Dispatch",
  "In Progress",
  "Completed",
  "Cancelled",
] as const;

export const PM_STYLES = ["6 month PM", "12 month PM", "36 month PM", "Grinder PM"] as const;

export const PARTS_STATUSES = [
  "Yes - All Available",
  "Partial",
  "No - Awaiting Parts",
  "On Order",
  "TBD / Check Inventory",
] as const;

export const EQUIP_STATUSES = ["Ready", "Not Ready", "Installed"] as const;

export const REQS_READY = ["Ready", "Not Ready"] as const;

export const PRODUCERS = [
  "Bill",
  "Lance",
  "Sean",
  "Shannon",
  "Lizbeth",
  "Amanda",
  "Jesus",
] as const;

export const PRODUCER_INITIALS: Record<string, string> = {
  Bill: "BM",
  Lance: "LO",
  Sean: "SM",
  Shannon: "SC",
  Lizbeth: "LR",
  Amanda: "AL",
  Jesus: "JG",
};

export const PAYMENT_TERMS = [
  "Payment Plan",
  "50% Down + 50% upon install/30 days after",
  "50% Down / 50% at Install or Net 30",
  "Lease",
  "Paid in Full",
  "No Purchased Equipment",
] as const;

export const ACCOUNT_TYPES = ["Avi Account", "Richard Account"] as const;

export const MODULE_PLATFORMS = ["Cameo", "Enigma / e'Line", "Legacy"] as const;

export const MODULE_TYPES = [
  "Brew Module",
  "Medium Brew Module",
  "Large Brew Module",
  "Steam S Module",
  "Steam M Module",
  "Hydraulic Module",
  "Grinder Module",
  "Milk Module",
  "Pump Module",
  "Powder Module",
] as const;

export const MODULE_STATUSES = [
  "Not Started",
  "In Progress",
  "Waiting on Parts",
  "Ready",
  "Ship to Eversys (Core Swap)",
  "At Eversys - Awaiting Return",
  "Installed at Account",
  "Retired / Scrapped",
] as const;

export const URGENCIES = ["Emergency", "High", "Normal", "Low"] as const;

export const URGENCY_RANK: Record<string, number> = {
  Emergency: 0,
  High: 1,
  Normal: 2,
  Low: 3,
};

export const CLOSED_CALL = new Set(["Completed", "Cancelled", "Phone Resolved"]);
export const CLOSED_PM = new Set(["Completed", "Cancelled"]);

const PRODUCER_INITIAL_VALUES = new Set(
  Object.values(PRODUCER_INITIALS).map((s) => s.toLowerCase()),
);

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/['’]/g, "");
}

function nameTokens(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const n = normalizeName(raw);
  if (!n) return [];
  const parts = n.split(/[\s@._+\-]+/).filter(Boolean);
  return [n, ...parts];
}

/** Keys used to decide whether a handoff item belongs to the signed-in person. */
export function userMatchKeys(user: {
  displayName: string | null;
  primaryEmail: string | null;
} | null): Set<string> {
  const keys = new Set<string>();
  if (!user) return keys;
  const add = (raw: string | null | undefined) => {
    for (const t of nameTokens(raw)) {
      if (t.length >= 3 || (t.length === 2 && PRODUCER_INITIAL_VALUES.has(t))) keys.add(t);
    }
  };
  add(user.displayName);
  add(user.primaryEmail);
  const parts = (user.displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const initials = (parts[0]![0]! + parts[1]![0]!).toLowerCase();
    if (PRODUCER_INITIAL_VALUES.has(initials)) keys.add(initials);
  }
  for (const [name, initials] of Object.entries(PRODUCER_INITIALS)) {
    if (keys.has(name.toLowerCase())) keys.add(initials.toLowerCase());
  }
  return keys;
}

export function namesMatchUser(
  user: { displayName: string | null; primaryEmail: string | null } | null,
  ...names: (string | null | undefined)[]
): boolean {
  const keys = userMatchKeys(user);
  if (!keys.size) return false;
  for (const name of names) {
    for (const t of nameTokens(name)) {
      if (keys.has(t)) return true;
    }
  }
  return false;
}

export const ASSET_KINDS = [
  { value: "equip", label: "Equipment" },
  { value: "dispenser", label: "Dispenser / accessory" },
  { value: "module", label: "Module" },
] as const;

export const ASSET_STATUSES = ["ready", "deployed", "assigned", "sold"] as const;

