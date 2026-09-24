export type DeskRole = "sales" | "service" | "warehouse" | null;
export type ViewLayout = "list" | "board" | "compact";

export type MyViewPrefs = {
  on: boolean;
  layout: ViewLayout;
};

export const MY_VIEW_KEY = "katz-desk-my-view";
export const MY_VIEW_EVENT = "katz-desk-my-view";

export const DEFAULT_MY_VIEW: MyViewPrefs = {
  on: true,
  layout: "list",
};

export function readMyView(): MyViewPrefs {
  if (typeof window === "undefined") return DEFAULT_MY_VIEW;
  try {
    const raw = window.localStorage.getItem(MY_VIEW_KEY);
    if (!raw) return DEFAULT_MY_VIEW;
    const parsed = JSON.parse(raw) as Partial<MyViewPrefs>;
    const layout: ViewLayout =
      parsed.layout === "board" || parsed.layout === "compact" || parsed.layout === "list"
        ? parsed.layout
        : "list";
    return {
      on: parsed.on !== false,
      layout,
    };
  } catch {
    return DEFAULT_MY_VIEW;
  }
}

export function writeMyView(patch: Partial<MyViewPrefs>): MyViewPrefs {
  const next = { ...readMyView(), ...patch };
  window.localStorage.setItem(MY_VIEW_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(MY_VIEW_EVENT));
  return next;
}

export function defaultLayoutFor(role: DeskRole): ViewLayout {
  if (role === "service") return "board";
  return "list";
}

/** Service My View: keep unassigned plus rows whose technician matches the signed-in person. */
export function mineByTechnician<T extends { technician?: string | null }>(
  list: T[],
  opts: {
    filterMine: boolean;
    role: DeskRole | string | null | undefined;
    matchMine: (...names: (string | null | undefined)[]) => boolean;
  },
): T[] {
  if (!opts.filterMine || opts.role !== "service") return list;
  return list.filter((row) => opts.matchMine(row.technician) || !row.technician);
}

